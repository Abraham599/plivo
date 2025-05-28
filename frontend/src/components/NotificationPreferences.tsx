import React from 'react';

const NotificationPreferences: React.FC = () => {
  return (
    <div className="p-4 border rounded-lg bg-card mb-6 max-w-md">
      <h3 className="font-semibold mb-4">Email Notifications</h3>
      <p className="text-sm text-muted-foreground">
        All email notifications are now enabled by default. You'll receive updates for service status changes, 
        new incidents, incident updates, and when incidents are resolved.
      </p>
    </div>
  );
};

export default NotificationPreferences;