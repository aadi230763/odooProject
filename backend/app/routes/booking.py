"""Booking blueprint — Phase 7 Resource Booking.

Endpoints
---------
  GET    /api/bookings
  POST   /api/bookings                           (any authenticated)
  PATCH  /api/bookings/<id>/cancel                (any authenticated)
  PATCH  /api/bookings/<id>/reschedule            (any authenticated)
  GET    /api/bookings/asset/<asset_id>           (calendar feed)
"""

from flask import Blueprint

from app.controllers import booking_controller
from app.middleware.auth import require_role

booking_bp = Blueprint("bookings", __name__)


@booking_bp.get("")
@require_role()
def list_bookings():
    return booking_controller.list_bookings()


@booking_bp.post("")
@require_role()
def create_booking():
    return booking_controller.create_booking()


@booking_bp.patch("/<int:booking_id>/cancel")
@require_role()
def cancel_booking(booking_id: int):
    return booking_controller.cancel_booking(booking_id)


@booking_bp.patch("/<int:booking_id>/reschedule")
@require_role()
def reschedule_booking(booking_id: int):
    return booking_controller.reschedule_booking(booking_id)


@booking_bp.get("/asset/<int:asset_id>")
@require_role()
def get_asset_bookings(asset_id: int):
    return booking_controller.get_asset_bookings(asset_id)
