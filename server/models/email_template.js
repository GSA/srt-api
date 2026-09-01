'use strict';

/**
 * An admin email template.
 *
 * templateKey rather than the numeric id is the stable identifier, because
 * admin_audit_log rows already record a template key string from when these
 * were hardcoded in the UI.
 */
module.exports = (sequelize, DataTypes) => {
  const EmailTemplate = sequelize.define('EmailTemplate', {
    templateKey: DataTypes.STRING,
    name: DataTypes.STRING,
    subject: DataTypes.STRING,
    body: DataTypes.TEXT,
    description: DataTypes.STRING,
    isBuiltIn: DataTypes.BOOLEAN,
    active: DataTypes.BOOLEAN,
    updatedBy: DataTypes.STRING
  }, { tableName: 'email_templates' });

  /** Turn a display name into a stable key when an admin creates a template. */
  EmailTemplate.keyFrom = function (name) {
    return String(name || '').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || null
  };

  return EmailTemplate;
};
