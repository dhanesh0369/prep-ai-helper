import json
import httpx
from fastapi import HTTPException
from pydantic import BaseModel
from typing import Any
from app.config import settings

GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

async def query_llm(
    prompt: str,
    system_instruction: str = "",
    response_format: str = "json_object"
) -> str:
    """
    Queries Groq API using OpenAI-compatible chat completions endpoint.
    """
    if not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Groq API Key is missing. Please configure GROQ_API_KEY in your backend .env file."
        )

    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.3,
        "response_format": {"type": response_format}
    }

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(GROQ_BASE_URL, json=payload, headers=headers, timeout=60.0)
            if response.status_code == 200:
                resp_data = response.json()
                return resp_data["choices"][0]["message"]["content"]
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Groq API Error {response.status_code}: {response.text}"
                )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to connect to Groq API: {str(e)}"
            )

def clean_schema(schema: Any) -> Any:
    """Recursively removes 'description' keys from a JSON schema to minimize token footprint."""
    if isinstance(schema, dict):
        return {k: clean_schema(v) for k, v in schema.items() if k != "description"}
    elif isinstance(schema, list):
        return [clean_schema(i) for i in schema]
    return schema

def dereference_schema(schema: Any) -> Any:
    """Recursively inlines $defs/$refs in a JSON schema for compatibility."""
    if not isinstance(schema, dict):
        return schema

    defs = schema.get("$defs", {})

    def resolve_refs(node: Any) -> Any:
        if isinstance(node, dict):
            if "$ref" in node:
                ref_path = node["$ref"]
                if ref_path.startswith("#/$defs/"):
                    def_name = ref_path.split("/")[-1]
                    if def_name in defs:
                        return resolve_refs(defs[def_name])
            return {k: resolve_refs(v) for k, v in node.items()}
        elif isinstance(node, list):
            return [resolve_refs(i) for i in node]
        return node

    resolved = resolve_refs(schema)
    if isinstance(resolved, dict) and "$defs" in resolved:
        del resolved["$defs"]
    return resolved

async def query_llm_structured(prompt: str, response_model: type[BaseModel], system_instruction: str = "") -> BaseModel:
    """
    Sends a prompt to Groq and validates the response against the Pydantic schema.
    """
    # Build clean schema description for Groq to follow
    schema_dict = clean_schema(dereference_schema(response_model.model_json_schema()))
    schema_str = json.dumps(schema_dict, indent=2)

    augmented_system = (
        (system_instruction + "\n\n" if system_instruction else "") +
        "You are a JSON generation assistant. You MUST respond with a single valid JSON object only. "
        "Do not include any explanation, markdown, or code block syntax. "
        f"Your output MUST strictly match this JSON schema:\n{schema_str}"
    )

    raw_response = await query_llm(
        prompt=prompt,
        system_instruction=augmented_system,
        response_format="json_object"
    )

    cleaned = raw_response.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        parsed_json = json.loads(cleaned)
        return response_model.model_validate(parsed_json)
    except Exception as e:
        print(f"Failed to parse structured LLM response. Raw output: {raw_response}")
        raise HTTPException(
            status_code=500,
            detail=f"AI model returned invalid JSON matching the schema: {str(e)}"
        )
