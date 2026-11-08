from . import models

try:
    from .service import checkout
except ImportError:
    checkout = None


def describe(user):
    return models.format_name(user)
