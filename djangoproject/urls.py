from django.urls import include, path
from django.views.generic import TemplateView

urlpatterns = [
    path('home', TemplateView.as_view(template_name='list_novels_view.html'), name='home'),
    path('api/', include('djangoproject.novels.urls')),
]