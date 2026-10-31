from django.db import models

class Novel(models.Model):
    novel_id = models.IntegerField(primary_key=True)
    novel_title = models.TextField()
    novel_author = models.TextField()
    novel_year = models.IntegerField()
    novel_description = models.TextField()
    max_chapter = models.IntegerField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def __str__(self):
        return self.novel_title

class Character(models.Model):
    novel_id = models.ForeignKey(
        'Novel',
        on_delete=models.CASCADE,
        related_name='characters',
        verbose_name='Novel')
    character_id = models.CharField(max_length=100)
    character_ver = models.IntegerField(default=1)

    character_name = models.TextField()
    character_role = models.TextField()
    min_chapter = models.IntegerField(default=1)
    max_chapter = models.IntegerField()

    class Meta:
        unique_together = (('novel_id', 'character_id', 'character_ver'),)

    def __str__(self):
        return self.character_name

class RelationshipEvent(models.Model):
    novel_id = models.ForeignKey(
        'Novel',
        on_delete=models.CASCADE,
        related_name='relationship_events',
        verbose_name='Novel')
    chapter = models.IntegerField()
    source = models.TextField(max_length=100)
    target = models.TextField(max_length=100)

    type = models.TextField()
    label = models.TextField()