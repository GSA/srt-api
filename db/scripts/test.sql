--- Run for first time setting up db to make sure values are in the db
--- for unit tests to work.

INSERT INTO notice_type (id, notice_type, "createdAt", "updatedAt")
VALUES (18, 'Combined Synopsis/Solicitation', '2020-02-19 22:26:38.651439', '2020-02-19 22:26:38.651439');

INSERT INTO notice ( id,    notice_type_id,    solicitation_number,    agency,    date,    notice_data,    compliant,    feedback,    history,    action,    "createdAt",    "updatedAt",    na_flag)                                                                                  
VALUES (40133, 18, 'SPE7M121U2094', 'DEPT OF DEFENSE', '2021-03-07 10:03:06.473499', '{"url": "https://beta.sam.gov/opp/cbe8bdcdf7e34941a02856c2f450492d/view", "naics": "3", "emails": ["DibbsBSM@dla.mil"], "office": "DEFENSE LOGISTICS AGENCY (DLA)", "subject": "59--Switch,Thermostatic", "classcod": "59", "setaside": ""}',    0,  NULL,    NULL,    NULL,    '2021-03-09 10:03:06.47351',    NULL,    false);

INSERT INTO notice_type (id, notice_type, "createdAt", "updatedAt")
VALUES (19, 'Solicitation', '2030-02-19 22:26:38.651439', '2030-02-19 22:26:38.651439');

INSERT INTO notice ( id,    notice_type_id,    solicitation_number,    agency,    date,    notice_data,    compliant,    feedback,    history,    action,    "createdAt",    "updatedAt",    na_flag)                                                                                  
VALUES (40134, 19, 'TEST12345', 'DEPT OF TEST', '2031-03-07 10:03:06.473499', '{"url": "https://beta.sam.gov/opp/cbe8bdcdf7e34941a02856c2f450492d/view", "naics": "3", "emails": ["DibbsBSM@dla.mil"], "office": "DEFENSE LOGISTICS AGENCY (DLA)", "subject": "59--Switch,Thermostatic", "classcod": "59", "setaside": ""}',    0,  NULL,    NULL,    NULL,    '2031-03-09 10:03:06.47351',    NULL,    false);