import httpx

prompt = (
    "Generate exactly 5 interview questions for a candidate based on the following details:\n"
    "- Interview Type: Technical\n"
    "- Difficulty Level: Medium\n"
    "- Candidate Skills: Python, React, JavaScript\n"
    "- Relevant Profile Details: None\n\n"
    "Generate questions that are highly professional, avoid generic questions, and focus "
    "directly on testing practical knowledge of their skills."
)

schema_details = """{
  "properties": {
    "questions": {
      "items": {
        "properties": {
          "question_text": {"type": "string"},
          "topic": {"type": "string"}
        },
        "required": ["question_text", "topic"],
        "type": "object"
      },
      "type": "array"
    }
  },
  "required": ["questions"],
  "type": "object"
}"""

augmented_prompt = (
    f"{prompt}\n\n"
    f"--- FORMATTING INSTRUCTIONS ---\n"
    f"Generate a populated JSON object using the actual values extracted from the input data. "
    f"Your output JSON object MUST strictly follow the structure defined by this schema (do not output the schema definitions, only return the populated data instance):\n"
    f"{schema_details}\n\n"
    f"Return ONLY valid raw JSON representing the data instance. Do not wrap in markdown code block syntax (like ```json)."
)

payload = {
    "model": "llama3:latest",
    "prompt": augmented_prompt,
    "format": "json",
    "stream": False
}

try:
    print("Querying Ollama...")
    resp = httpx.post("http://localhost:11434/api/generate", json=payload, timeout=60.0)
    print("Status:", resp.status_code)
    print("Raw Response:", resp.text[:1000])
except Exception as e:
    print("Error:", e)
