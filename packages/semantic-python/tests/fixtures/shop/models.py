from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .service import Order


class Base:
    def save(self):
        return True


def format_name(user):
    return _clean(str(user))


def _clean(text):
    return text.strip()
