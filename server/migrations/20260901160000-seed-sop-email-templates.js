'use strict';

/**
 * Seed the six templates from the Section 508 Program's email SOP.
 *
 * Source: "Solicitation Review Tool Email — Section 508 Program Standard
 * Operating Procedures". These were being sent by hand from the SRT@gsa.gov
 * mailbox against a written procedure, which is why the SOP exists at all.
 *
 * Wording is taken from the SOP as written. Two deliberate changes:
 *
 * The [First name] marker becomes {{first_name}}, matching the placeholder
 * style the existing templates already use ({{days_inactive}}, {{update_notes}}).
 *
 * The Login.gov troubleshooting template had a specific person's address
 * hardcoded as the one to select, so every recipient was told to choose someone
 * else's email. That is now {{government_email}}.
 *
 * Guarded and idempotent: a template an administrator has since edited is never
 * overwritten.
 */

const P = (...lines) => lines.join('\n')

const TEMPLATES = [
  {
    templateKey: 'access_granted',
    name: 'Access Granted',
    subject: 'SRT Access Granted!',
    description: 'SOP step 6. Federal .gov or .mil address, status set to active.',
    body: P(
      '<p>Hello {{first_name}}</p>',
      '<p>You have been given access to the new Solicitation Review Tool. Please email us with additional questions, comments, and suggestions.</p>',
      '<ul>',
      '<li><a href="https://srt.app.cloud.gov">Login to the Solicitation Review Tool</a></li>',
      '<li><a href="https://www.section508.gov">About SRT</a></li>',
      '</ul>',
      '<p>By signing up for SRT, you agree to receive emails announcing new features, SRT trainings, and other product-related information.</p>',
      '<p>Sincerely,<br>SRT Team</p>'
    )
  },
  {
    templateKey: 'request_access',
    name: 'Request Access',
    subject: 'Instructions for Accessing SRT',
    description: 'SOP step 3. Someone emailed asking for access but has no pending request.',
    body: P(
      '<p>Hello {{first_name}}</p>',
      '<p>Thanks for reaching out. To access the SRT, please navigate to <a href="https://srt.app.cloud.gov/auth">srt.app.cloud.gov/auth</a> and create a Login.gov account using your government email. After you have created your account, try logging into SRT. Once you have logged in for the first time it will prompt us to accept your request, and we can assist you with gaining access to your organization\'s solicitations.</p>',
      '<p>Sincerely,<br>SRT Team</p>'
    )
  },
  {
    templateKey: 'government_email_needed',
    name: 'Government Email Needed',
    subject: 'Government Email Address Required',
    description: 'SOP step 5. Personal or generic address, status set to decline. This is the notice the auto-decline policy sends.',
    body: P(
      '<p>Hello {{first_name}}</p>',
      '<p>You have requested SRT access with an email address not assigned to an individual government employee. Please use your government email with Login.gov to resubmit your request to SRT. Generic emails do not allow us to provide secure access in accordance with requirements set forth in our Authority To Operate.</p>',
      '<p>Thank you,<br>SRT Team</p>'
    )
  },
  {
    templateKey: 'non_agency_access_granted',
    name: 'Non-Agency Account Access Granted',
    subject: 'SRT Access for Non federal users',
    description: 'SOP step 7. A .edu or non-federal .gov address, for example a state agency. Upload tool only, no agency solicitation feed.',
    body: P(
      '<p>Hello {{first_name}}</p>',
      '<p>You have requested access to SRT and you have been given access to the tool. You will be able to upload and review any solicitations you would like to check for their Section 508 language.</p>',
      '<p>It appears that you are from an entity that is not associated with a Federal government agency or component. As such, you will not be able to view published solicitations associated with a particular agency in the database. People are only able to view solicitations for the federal agency to which they belong.</p>',
      '<p>By signing up for SRT, you agree to receive emails announcing new features, SRT trainings, and other product-related information.</p>',
      '<p>Sincerely,<br>SRT Team</p>'
    )
  },
  {
    templateKey: 'logingov_troubleshooting',
    name: 'Login.gov Troubleshooting',
    subject: 'Troubleshooting access via Login.gov',
    description: 'Sent when a government email will not connect through Login.gov. Largely superseded once SRT requests the all_emails scope, which resolves the underlying cause.',
    body: P(
      '<p>Hello {{first_name}}</p>',
      '<p>We understand that you are unable to connect your Login.gov account to SRT with your government email. This has to do with the way Login.gov is configured with the SRT application. This is not user error but a problem with the default configuration of our app. We are making that change for future Login.gov users, and in the meantime you can do the following to update this manually and receive access.</p>',
      '<p>Try the following:</p>',
      '<ol>',
      '<li>Sign in at <a href="https://secure.login.gov">secure.login.gov</a></li>',
      '<li>Click "Your connected accounts"</li>',
      '<li>Find the GSA / Solicitation Review Tool connection and click "Select the email you would like to share", then choose {{government_email}}</li>',
      '<li>Sign in to SRT again at <a href="https://srt.app.cloud.gov">srt.app.cloud.gov</a></li>',
      '</ol>',
      '<p>Thank you,<br>SRT Team</p>'
    )
  },
  {
    templateKey: 'which_agency',
    name: 'Which Agency',
    subject: 'Agency access, information needed',
    description: 'SOP step 8. A federal .gov address where the agency is unclear. Status stays pending. Pairs with the Needs Review queue.',
    body: P(
      '<p>Hello {{first_name}}</p>',
      '<p>You have requested access to SRT. Can you please confirm which agency solicitations you will need to access?</p>',
      '<p>If you are looking for the SRT Upload tool to check solicitations prior to publication, we can also provide you with access to the tool without agency association. Please let us know which you prefer.</p>',
      '<p>Thank you,<br>SRT Team</p>'
    )
  }
]

module.exports = {
  up: async (queryInterface) => {
    const tables = await queryInterface.showAllTables()
    const names = tables.map(t => (typeof t === 'string' ? t : t.tableName))
    if (!names.includes('email_templates')) return   // the creating migration runs first

    for (const t of TEMPLATES) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id FROM email_templates WHERE "templateKey" = :k',
        { replacements: { k: t.templateKey } }
      )
      if (existing.length) continue      // never overwrite an edited template
      await queryInterface.sequelize.query(
        `INSERT INTO email_templates
           ("templateKey", name, subject, body, description, "isBuiltIn", active, "createdAt", "updatedAt")
         VALUES (:templateKey, :name, :subject, :body, :description, true, true, NOW(), NOW())`,
        { replacements: t }
      )
    }
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `DELETE FROM email_templates WHERE "templateKey" IN (${TEMPLATES.map(t => `'${t.templateKey}'`).join(',')})`
    )
  }
};
