"""Guide forum — questions + answers, one-level threading."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import Animal, GuideAnswer, GuideQuestion, User
from ..points import award, get_config

router = APIRouter(prefix="/animals", tags=["forum"])


class QuestionIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    body: str | None = None


class AnswerIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class QuestionOut(BaseModel):
    id: int
    animal_id: int
    user_id: int
    author_name: str | None
    title: str
    body: str | None
    created_at: str
    answer_count: int
    accepted_answer_id: int | None


class AnswerOut(BaseModel):
    id: int
    question_id: int
    user_id: int
    author_name: str | None
    body: str
    created_at: str
    accepted: bool


@router.get("/{slug}/questions")
def list_questions(slug: str, db: Session = Depends(get_db)) -> list[QuestionOut]:
    animal = db.query(Animal).filter(Animal.slug == slug).first()
    if not animal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal not found")
    rows = (
        db.query(GuideQuestion)
        .filter(GuideQuestion.animal_id == animal.id)
        .order_by(GuideQuestion.created_at.desc())
        .all()
    )
    authors = {
        u.id: u for u in db.query(User).filter(User.id.in_({r.user_id for r in rows})).all()
    } if rows else {}
    counts = {
        q.id: db.query(GuideAnswer).filter(GuideAnswer.question_id == q.id).count()
        for q in rows
    }
    return [
        QuestionOut(
            id=q.id,
            animal_id=q.animal_id,
            user_id=q.user_id,
            author_name=(authors.get(q.user_id).display_name if authors.get(q.user_id) else None),
            title=q.title,
            body=q.body,
            created_at=q.created_at.isoformat(),
            answer_count=counts[q.id],
            accepted_answer_id=q.accepted_answer_id,
        )
        for q in rows
    ]


@router.post("/{animal_id}/questions", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
def ask(
    animal_id: int,
    data: QuestionIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuestionOut:
    animal = db.get(Animal, animal_id)
    if not animal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal not found")
    q = GuideQuestion(animal_id=animal_id, user_id=user.id, title=data.title, body=data.body)
    db.add(q)
    db.commit()
    db.refresh(q)
    return QuestionOut(
        id=q.id,
        animal_id=q.animal_id,
        user_id=q.user_id,
        author_name=user.display_name,
        title=q.title,
        body=q.body,
        created_at=q.created_at.isoformat(),
        answer_count=0,
        accepted_answer_id=None,
    )


@router.get("/questions/{question_id}/answers")
def list_answers(question_id: int, db: Session = Depends(get_db)) -> list[AnswerOut]:
    question = db.get(GuideQuestion, question_id)
    if not question:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    rows = (
        db.query(GuideAnswer)
        .filter(GuideAnswer.question_id == question_id)
        .order_by(GuideAnswer.created_at)
        .all()
    )
    authors = {
        u.id: u for u in db.query(User).filter(User.id.in_({r.user_id for r in rows})).all()
    } if rows else {}
    return [
        AnswerOut(
            id=a.id,
            question_id=a.question_id,
            user_id=a.user_id,
            author_name=(authors.get(a.user_id).display_name if authors.get(a.user_id) else None),
            body=a.body,
            created_at=a.created_at.isoformat(),
            accepted=(question.accepted_answer_id == a.id),
        )
        for a in rows
    ]


@router.post("/questions/{question_id}/answers", response_model=AnswerOut, status_code=status.HTTP_201_CREATED)
def answer(
    question_id: int,
    data: AnswerIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnswerOut:
    question = db.get(GuideQuestion, question_id)
    if not question:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    ans = GuideAnswer(question_id=question_id, user_id=user.id, body=data.body)
    db.add(ans)
    db.commit()
    db.refresh(ans)
    cfg = get_config(db)
    award(db, user, "answer_created", cfg.answer_created, ref_type="answer", ref_id=ans.id)
    return AnswerOut(
        id=ans.id,
        question_id=ans.question_id,
        user_id=ans.user_id,
        author_name=user.display_name,
        body=ans.body,
        created_at=ans.created_at.isoformat(),
        accepted=False,
    )


@router.post("/questions/{question_id}/accept/{answer_id}")
def accept_answer(
    question_id: int,
    answer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    question = db.get(GuideQuestion, question_id)
    if not question:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    if question.user_id != user.id and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the asker can accept an answer")
    ans = db.get(GuideAnswer, answer_id)
    if not ans or ans.question_id != question.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Answer not found")
    already = question.accepted_answer_id == ans.id
    question.accepted_answer_id = ans.id
    db.commit()
    if not already:
        cfg = get_config(db)
        answerer = db.get(User, ans.user_id)
        award(db, answerer, "answer_accepted", cfg.answer_accepted,
              ref_type="answer", ref_id=ans.id,
              note=f"Answer accepted on '{question.title}'")
    return {"ok": True}
