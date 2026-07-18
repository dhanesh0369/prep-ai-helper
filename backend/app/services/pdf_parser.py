import fitz  # PyMuPDF

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extracts text from PDF bytes block-by-block to preserve layout order,
    preventing issues with multi-column resume styles merging inappropriately.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    text_blocks = []
    
    for page in doc:
        # page.get_text("blocks") returns a list of tuples:
        # (x0, y0, x1, y1, "text", block_no, block_type)
        blocks = page.get_text("blocks")
        
        # Sort primarily by x0 (columns) then y0 (top-to-bottom) if needed,
        # but default get_text("blocks") is pre-sorted layout-aware.
        for b in blocks:
            text_content = b[4].strip()
            if text_content:
                text_blocks.append(text_content)
                
    return "\n\n".join(text_blocks)
