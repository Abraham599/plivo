from jinja2 import Environment, FileSystemLoader
import os

# Initialize Jinja2 environment
template_dir = os.path.join(os.path.dirname(__file__), 'email')
env = Environment(loader=FileSystemLoader(template_dir))

def render_service_status_change_email(service_name, old_status, new_status, organization_name):
    template = env.get_template('service_status_change.html')
    return template.render(
        service_name=service_name,
        old_status=old_status.replace('_', ' ').title(),
        new_status=new_status.replace('_', ' ').title(),
        organization_name=organization_name
    )

def render_new_incident_email(incident_title, incident_description, services, organization_name):
    template = env.get_template('new_incident.html')
    return template.render(
        incident_title=incident_title,
        incident_description=incident_description,
        services=services,
        organization_name=organization_name
    )

def render_incident_update_email(incident_title, update_message, organization_name):
    template = env.get_template('incident_update.html')
    return template.render(
        incident_title=incident_title,
        update_message=update_message,
        organization_name=organization_name
    )

def render_incident_resolved_email(incident_title, organization_name):
    template = env.get_template('incident_resolved.html')
    return template.render(
        incident_title=incident_title,
        organization_name=organization_name
    )
