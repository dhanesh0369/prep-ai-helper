from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Any

class ProjectSchema(BaseModel):
    title: Optional[str] = Field(None, description="Name/title of the project")
    description: Optional[str] = Field(None, description="Description of what was built and technologies used")

class ExperienceSchema(BaseModel):
    company: Optional[str] = Field(None, description="Name of the company/organization")
    role: Optional[str] = Field(None, description="Job title/role")
    duration: Optional[str] = Field(None, description="Employment duration (e.g. June 2022 - Present)")
    responsibilities: List[str] = Field(default_factory=list, description="Key responsibilities and bullet points")

class EducationSchema(BaseModel):
    institution: Optional[str] = Field(None, description="Name of the school, college, or university")
    degree: Optional[str] = Field(None, description="Degree, diploma, or field of study")
    duration: Optional[str] = Field(None, description="Study duration or graduation year")
    gpa: Optional[str] = Field(None, description="GPA or grade details if mentioned")

class ResumeParsedData(BaseModel):
    skills: List[str] = Field(default_factory=list, description="Extracted programming languages, frameworks, databases, and tools")
    projects: List[ProjectSchema] = Field(default_factory=list, description="List of projects mentioned in the resume")
    experience: List[ExperienceSchema] = Field(default_factory=list, description="Professional work experience details")
    education: List[EducationSchema] = Field(default_factory=list, description="Degrees, colleges, and graduation details")

    @model_validator(mode='before')
    @classmethod
    def clean_skills(cls, data: Any) -> Any:
        if isinstance(data, dict) and "skills" in data:
            raw_skills = data["skills"]
            if isinstance(raw_skills, list):
                flat_skills = []
                for item in raw_skills:
                    if isinstance(item, str):
                        flat_skills.append(item)
                    elif isinstance(item, dict):
                        # Extract list from common nested key variants ('tech', 'technologies', 'skills', 'items')
                        tech_list = item.get("tech") or item.get("technologies") or item.get("skills") or item.get("items")
                        if isinstance(tech_list, list):
                            flat_skills.extend([str(t) for t in tech_list])
                        elif isinstance(tech_list, str):
                            flat_skills.append(tech_list)
                        else:
                            # Fallback: collect any lists or string values inside the dictionary
                            for val in item.values():
                                if isinstance(val, list):
                                    flat_skills.extend([str(v) for v in val])
                                elif isinstance(val, str):
                                    flat_skills.append(val)
                    elif isinstance(item, list):
                        flat_skills.extend([str(i) for i in item])
                # Remove duplicates while preserving insertion order
                data["skills"] = list(dict.fromkeys(flat_skills))
        return data
