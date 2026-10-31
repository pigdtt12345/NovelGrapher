from rest_framework import serializers
from .models import Novel, Character, RelationshipEvent


class NovelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Novel
        fields = '__all__'

class CharacterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Character
        fields = '__all__'

class RelationshipEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = RelationshipEvent
        fields = '__all__'

class NovelRelationshipSerializer(serializers.ModelSerializer):
    characters = CharacterSerializer(many=True, read_only=True)
    relationship_events = RelationshipEventSerializer(many=True, read_only=True)

    class Meta:
        model = Novel
        fields = '__all__'