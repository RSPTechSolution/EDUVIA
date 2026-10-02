import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.communication import Survey, SurveyResponse

def calculate_nps(scores: list[int]) -> float:
    """Scores are 0-10. NPS = %Promoters(9-10) - %Detractors(0-6)"""
    if not scores:
        return 0.0
    total = len(scores)
    promoters = sum(1 for s in scores if s >= 9) / total * 100
    detractors = sum(1 for s in scores if s <= 6) / total * 100
    return round(promoters - detractors, 1)

async def get_survey_analytics(db: AsyncSession, survey_id: uuid.UUID) -> dict:
    survey = await db.get(Survey, survey_id)
    if not survey:
        raise ValueError("Survey not found")
        
    responses = await db.scalars(select(SurveyResponse).where(SurveyResponse.survey_id == survey_id))
    responses = list(responses.all())

    analytics = {}
    for question in survey.questions:
        q_id = question["id"]
        q_type = question["type"]
        answers = [r.answers.get(q_id) for r in responses if r.answers.get(q_id) is not None]

        if q_type == "nps":
            analytics[q_id] = {"type": "nps", "score": calculate_nps([int(a) for a in answers]), "count": len(answers)}
        elif q_type in ("mcq", "checkbox"):
            from collections import Counter
            analytics[q_id] = {"type": q_type, "distribution": dict(Counter(str(a) for a in answers))}
        elif q_type == "rating":
            analytics[q_id] = {"type": "rating", "average": sum(int(a) for a in answers) / len(answers) if answers else 0}
        else:
            analytics[q_id] = {"type": q_type, "responses": answers[:50]}  # sample

    return {"total_responses": len(responses), "analytics": analytics}
