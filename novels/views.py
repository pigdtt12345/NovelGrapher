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
    queryset = Novel.objects.all()
    serializer_class = NovelSerializer

    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['novel_title']

    @action(detail=True, methods=['get'], url_path='timeline')
    def timeline(self, request, pk=None):
        novel = self.get_object()  # 自动根据 url 中的 id (pk) 获取 Novel 实例
        serializer = self.get_serializer(novel)
        return JsonResponse({
        'min_chapter': 0,
        'max_chapter': serializer.data['max_chapter'],
    })

    @action(detail=True, methods=['get'], url_path='relationships')
    def relationships(self, request, pk=None):
        chapter_param = request.query_params.get('chapter')

        if chapter_param:
            chapter_num = int(chapter_param)
            filtered_events = RelationshipEvent.objects.filter(chapter__lte=chapter_num)
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