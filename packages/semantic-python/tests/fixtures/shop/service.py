from .models import Base

try:
    import ujson as json
except ImportError:
    import json


class Order(Base):
    def total(self):
        return self.subtotal()

    def subtotal(self):
        return json.dumps(0)


def checkout(user):
    from .models import format_name

    order = Order()
    order.save()
    return format_name(user)
