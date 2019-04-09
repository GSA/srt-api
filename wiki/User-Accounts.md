# Summary
From a UI standpoint, SRT Users have a role and agency. There are currently 5 roles:
* Administrator
* SRT Program Manager
* Section 508 Coordinator
* Contracting Officer
* Executive User

In the code there are actually only 3 (maybe 4?) access levels at this time:
* GSA Admin
* GSA SRT Program Manager
* Registered User
* _Possibly a GSA user who is a sec 508 coordinator, CO, or executive user might behave differently than if their agency was different, but I don't think so._

To be an "GSA Admin", a user must have an agency of "General Services Administration" and also be in the Administrator role. GSA Admin users can see all pages and data.  If a user is a SRT Program Manager role and also GSA, they can do everything that a GSA Admin can except approving users. All other registered users regardless of role are registered users. Registered users can only see data from their own agency. I'm not sure what pages, if any, they are restricted from viewing.

