"""Social feed — posts, likes, comments."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, get_optional_user
from ..models import Comment, Like, Post, User
from ..schemas import AuthorMini, CommentIn, CommentOut, PostIn, PostOut

router = APIRouter(prefix="/posts", tags=["posts"])


def _post_to_out(post: Post, viewer: User | None, like_count: int, comment_count: int, liked: bool) -> PostOut:
    return PostOut(
        id=post.id,
        author=AuthorMini(
            id=post.author_id,
            display_name=post.author.display_name if post.author else None,
            avatar_url=post.author.avatar_url if post.author else None,
        ),
        animal_id=post.animal_id,
        caption=post.caption,
        image_url=post.image_url,
        like_count=like_count,
        comment_count=comment_count,
        liked_by_me=liked,
        created_at=post.created_at,
    )


@router.get("", response_model=list[PostOut])
def list_posts(
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
    limit: int = 50,
    offset: int = 0,
) -> list[PostOut]:
    posts = (
        db.query(Post)
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(min(limit, 100))
        .all()
    )
    # Batch counts to avoid N+1.
    ids = [p.id for p in posts]
    if not ids:
        return []
    like_counts = dict(
        db.execute(
            select(Like.post_id, func.count(Like.id)).where(Like.post_id.in_(ids)).group_by(Like.post_id)
        ).all()
    )
    comment_counts = dict(
        db.execute(
            select(Comment.post_id, func.count(Comment.id))
            .where(Comment.post_id.in_(ids))
            .group_by(Comment.post_id)
        ).all()
    )
    liked_ids: set[int] = set()
    if viewer:
        liked_ids = {
            row[0]
            for row in db.execute(
                select(Like.post_id).where(Like.post_id.in_(ids), Like.user_id == viewer.id)
            ).all()
        }
    return [
        _post_to_out(
            p,
            viewer,
            like_counts.get(p.id, 0),
            comment_counts.get(p.id, 0),
            p.id in liked_ids,
        )
        for p in posts
    ]


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    data: PostIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PostOut:
    post = Post(
        author_id=user.id,
        caption=data.caption,
        image_url=data.image_url,
        animal_id=data.animal_id,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _post_to_out(post, user, 0, 0, False)


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    if post.author_id != user.id and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your post")
    db.delete(post)
    db.commit()


@router.post("/{post_id}/like")
def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    existing = db.query(Like).filter(Like.post_id == post_id, Like.user_id == user.id).first()
    if existing:
        return
    db.add(Like(post_id=post_id, user_id=user.id))
    db.commit()


@router.delete("/{post_id}/like")
def unlike_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    db.query(Like).filter(Like.post_id == post_id, Like.user_id == user.id).delete()
    db.commit()


@router.get("/{post_id}/comments", response_model=list[CommentOut])
def list_comments(post_id: int, db: Session = Depends(get_db)) -> list[CommentOut]:
    comments = db.query(Comment).filter(Comment.post_id == post_id).order_by(Comment.created_at).all()
    out: list[CommentOut] = []
    for c in comments:
        author = db.get(User, c.author_id)
        out.append(
            CommentOut(
                id=c.id,
                author=AuthorMini(
                    id=c.author_id,
                    display_name=author.display_name if author else None,
                    avatar_url=author.avatar_url if author else None,
                ),
                body=c.body,
                created_at=c.created_at,
            )
        )
    return out


@router.post("/{post_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def add_comment(
    post_id: int,
    data: CommentIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CommentOut:
    if not db.get(Post, post_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    comment = Comment(post_id=post_id, author_id=user.id, body=data.body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return CommentOut(
        id=comment.id,
        author=AuthorMini(id=user.id, display_name=user.display_name, avatar_url=user.avatar_url),
        body=comment.body,
        created_at=comment.created_at,
    )


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    comment = db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    if comment.author_id != user.id and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your comment")
    db.delete(comment)
    db.commit()
