from rest_framework import serializers
from .models import Novel, NovelTranslation, Character, CharacterTranslation, RelationshipEvent, RelationshipEventTranslation

class NovelTranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = NovelTranslation
        fields = '__all__'

class NovelSerializer(serializers.ModelSerializer):
    translations = NovelTranslationSerializer(many=True)
    class Meta:
        model = Novel
        fields = '__all__'

class CharacterTranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = CharacterTranslation
        fields = '__all__'

class CharacterSerializer(serializers.ModelSerializer):
    translations = CharacterTranslationSerializer(many=True)
    class Meta:
        model = Character
        fields = '__all__'

class RelationshipEventTranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = RelationshipEventTranslation
        fields = '__all__'

class RelationshipEventSerializer(serializers.ModelSerializer):
    translations = RelationshipEventTranslationSerializer(many=True)
    class Meta:
        model = RelationshipEvent
        fields = '__all__'

class NovelRelationshipSerializer(serializers.ModelSerializer):
    characters = CharacterSerializer(many=True, read_only=True)
    relationship_events = RelationshipEventSerializer(many=True, read_only=True)

    class Meta:
        model = Novel
        fields = '__all__'