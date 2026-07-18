from app.services.pdf_parser import extract_text_from_pdf
from app.services.llm_client import query_llm_structured
from app.schemas.resume import ResumeParsedData

async def parse_and_extract_resume(file_bytes: bytes) -> ResumeParsedData:
    """
    Ties the PDF extraction and LLM client validation together to process resumes.
    """
    raw_text = extract_text_from_pdf(file_bytes)
    
    system_instruction = (
        "You are a professional HR and resume parsing model. "
        "Your task is to extract structured entities from raw resume text accurately. "
        "Ensure skills are parsed as clean strings (e.g. 'React' instead of 'React.js component library')."
    )
    
    prompt = (
        f"Analyze the candidate's resume text below and extract their skills, projects, professional experience, and education details.\n"
        f"Create a JSON instance populated with the extracted details from the resume, structuring the fields exactly as required by the schema.\n\n"
        f"--- START RESUME TEXT ---\n"
        f"{raw_text}\n"
        f"--- END RESUME TEXT ---\n"
    )
    
    parsed_data = await query_llm_structured(
        prompt=prompt,
        response_model=ResumeParsedData,
        system_instruction=system_instruction
    )
    
    return parsed_data
