"""
提供仅用于反序列化教务系统 API 响应数据的中间类型。
"""

from typing import Optional

from pydantic import Field, field_validator

from gdut_course_grabber.models import Course as CourseModel
from gdut_course_grabber.models import CourseSource
from gdut_course_grabber.models import Lesson as LessonModel


class Course(CourseModel):
    id: int = Field(validation_alias="kcrwdm")
    name: str = Field(validation_alias="kcmc")
    teacher: str = Field(validation_alias="teaxm")
    category: str = Field(validation_alias="kcflmc")
    chosen: int = Field(validation_alias="jxbrs")
    limit: int = Field(validation_alias="pkrs")
    source: CourseSource = CourseSource.EAS
    note: str = ""


class Lesson(LessonModel):
    name: str = Field(validation_alias="jxbmc")
    term: str = Field(validation_alias="xnxqmc")
    content_type: str = Field(validation_alias="jxhjmc")
    location_type: str = Field(validation_alias="zdgnqmc")
    location: str = Field(validation_alias="zdjxcdmc")
    teachers: list[str] = Field(validation_alias="teaxms")
    week: int = Field(validation_alias="zc")
    day: Optional[int] = Field(validation_alias="xq", default=None)
    sessions: Optional[list[int]] = Field(validation_alias="jcdm2", default=None)

    @field_validator("teachers", mode="before")
    @classmethod
    def split_teachers(cls, value: str) -> list[str]:
        return value.split(",")

    @field_validator("sessions", mode="before")
    @classmethod
    def split_sessions(cls, value: str) -> Optional[list[int]]:
        if not value or not value.strip():
            return None
        return list(map(int, value.split(",")))

    @field_validator("day", mode="before")
    @classmethod
    def parse_day(cls, value: str | int) -> Optional[int]:
        if isinstance(value, str) and not value.strip():
            return None
        return int(value)
