from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NovelViewSet, CharacterViewSet, RelationshipEventViewSet

router = DefaultRouter()
router.register(r'novels', NovelViewSet)
router.register(r'characters', CharacterViewSet)
router.register(r'relationship_events', RelationshipEventViewSet)

urlpatterns = [
    path('', include(router.urls)),
]