from django.http.response import JsonResponse
from rest_framework import viewsets
from rest_framework.response import Response
from .models import Novel, Character, RelationshipEvent
from .serializers import NovelSerializer, CharacterSerializer, RelationshipEventSerializer, NovelRelationshipSerializer
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter
from rest_framework.decorators import action
from django.db.models import Prefetch

class NovelViewSet(viewsets.ModelViewSet):
    serializer_class = NovelSerializer

    def get_queryset(self):
        qs = Novel.objects.prefetch_related("translations")
        lang = self.request.query_params.get("lang")
        if lang:
            qs = qs.filter(translations__language=lang).distinct()
        return qs

    @action(detail=True, methods=['get'], url_path='timeline')
    def timeline(self, request, pk=None):
        novel = self.get_object()
        serializer = self.get_serializer(novel)
        return JsonResponse({
        'min_chapter': serializer.data['min_chapter'],
        'max_chapter': serializer.data['max_chapter'],
    })

    @action(detail=True, methods=['get'], url_path='relationships')
    def relationships(self, request, pk=None):
        chapter_param = request.query_params.get('chapter')
        lang = self.request.query_params.get("lang")

        if chapter_param:
            chapter_num = int(chapter_param)
            filtered_events = RelationshipEvent.objects.filter(chapter__lte=chapter_num, translations__language=lang)
            novel = Novel.objects.prefetch_related('characters', Prefetch('relationship_events', queryset=filtered_events)).get(pk=pk)
        else:
            novel = Novel.objects.prefetch_related('characters', 'relationship_events').get(pk=pk)

        serializer = NovelRelationshipSerializer(novel)
        return Response(serializer.data)

class CharacterViewSet(viewsets.ModelViewSet):
    queryset = Character.objects.all()
    serializer_class = CharacterSerializer

    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['character_name']

class RelationshipEventViewSet(viewsets.ModelViewSet):
    queryset = RelationshipEvent.objects.all()
    serializer_class = RelationshipEventSerializer

    filter_backends = [DjangoFilterBackend, SearchFilter]