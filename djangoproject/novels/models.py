from django.db import models

class Novel(models.Model):
    min_chapter = models.IntegerField(default=1)
    max_chapter = models.IntegerField()

class NovelTranslation(models.Model):
    novel = models.ForeignKey(
        Novel,
        on_delete=models.CASCADE,
        related_name='translations',
        verbose_name='Novel')
    language = models.CharField(max_length=10)
    novel_title = models.TextField()
    novel_author = models.TextField()
    novel_year = models.IntegerField()
    novel_description = models.TextField(null=True, blank=True)

    class Meta:
        unique_together = (('novel', 'language'),)

    def __str__(self):
        return self.novel_title


class Character(models.Model):
    novel = models.ForeignKey(
        Novel,
        on_delete=models.CASCADE,
        related_name='characters',
        verbose_name='novel')
    min_chapter = models.IntegerField(default=1)
    max_chapter = models.IntegerField()

class CharacterTranslation(models.Model):
    character = models.ForeignKey(
        Character,
        on_delete=models.CASCADE,
        related_name='translations',
        verbose_name='character')
    language = models.CharField(max_length=10)
    character_name = models.TextField()
    character_role = models.TextField()

    class Meta:
        unique_together = (('character', 'language'),)

    def __str__(self):
        return self.character_name

class RelationshipEvent(models.Model):
    novel = models.ForeignKey(
        Novel,
        on_delete=models.CASCADE,
        related_name='relationship_events',
        verbose_name='Novel')
    chapter = models.IntegerField()
    source = models.IntegerField()
    target = models.IntegerField()

class RelationshipEventTranslation(models.Model):
    relationship_event = models.ForeignKey(
        RelationshipEvent,
        on_delete=models.CASCADE,
        related_name='translations',
        verbose_name='relationship_event')
    language = models.CharField(max_length=10)

    type = models.TextField()
    label = models.TextField()

    class Meta:
        unique_together = (('relationship_event', 'language'),)

    def __str__(self):
        return self.label