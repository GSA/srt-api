jest.mock('../config/configuration', () => {
    const originalModule = jest.requireActual('../config/configuration');
    return {
      ...originalModule,
      getConfig: (key, defaultValue, dictionary) => {
        // Handle agency mapping cases
        if (key.startsWith('AGENCY_MAP:')) {
          const agency = key.replace('AGENCY_MAP:', '');
          console.log('AGENCY_MAP lookup for:', agency);
          if (agency === 'Department of Defense') {
            return 'DEPT OF THE ARMY';
          }
          if (agency === 'Department of Homeland Security') {
            return 'US SECRET SERVICE';
          }
        }
        // Handle other configuration cases
        switch(key) {
          case 'AGENCY_LOOKUP':
            return AGENCY_LOOKUP;
          case 'VisibleNoticeTypes':
            return ['Solicitation', 'Combined Synopsis/Solicitation', 'RFQ'];
          case 'minPredictionCutoffDate':
            return '1990-01-01';
          default:
            return originalModule.getConfig(key, defaultValue, dictionary);
        }
      },
    };
  });
  
  const request = require('supertest');
  const predictionRoutes = require('../routes/prediction.routes');
  const mocks = require('./mocks');
  const db = require('../models/index');
  
  describe('Agency Filtering Tests', () => {
    let testAgency;
    
    beforeAll(async () => {
      process.env.minPredictionCutoffDate = '1990-01-01';
      const results = await db.sequelize.query(
        "select distinct agency from solicitations where agency is not null limit 1"
      );
      testAgency = results[0][0].agency;
      console.log('Test starting with agency:', testAgency);
    });
  
    afterAll(async () => {
      await db.sequelize.close();
    });
  
    test("Verify filtering by agency name returns only matching solicitations", async () => {
      const filter = {
        filters: {
          agency: { value: testAgency, matchMode: "equals" }
        },
        first: 0,
        rows: 50
      };
  
      console.log('Running admin filter test with agency:', testAgency);
      const { predictions } = await predictionRoutes.getPredictions(filter, mocks.mockAdminUser);
      console.log(`Got ${predictions.length} predictions for admin user`);
      
      expect(predictions.length).toBeGreaterThan(0);
      predictions.forEach(pred => {
        expect(pred.agency).toBe(testAgency);
      });
    });
  
    test("Verify predictions filtered correctly for army.mil user", async () => {
      console.log('Testing Army user:', mocks.mockArmyUser);
      const filter = { first: 0, rows: 50 };
      const { predictions } = await predictionRoutes.getPredictions(filter, mocks.mockArmyUser);
  
      console.log(`Got ${predictions.length} predictions for Army user`);
      console.log('First prediction agency:', predictions[0]?.agency);
      console.log('Mapped agency:', predictionRoutes.mapAgency(predictions[0]?.agency));
  
      expect(predictions.length).toBeGreaterThan(0);
      predictions.forEach(pred => {
        const mappedAgency = predictionRoutes.mapAgency(pred.agency);
        expect(mappedAgency).toBe(mocks.mockAgencies.ARMY);
      });
    });
  
    test("Verify predictions filtered correctly for usss.dhs.gov user", async () => {
      console.log('Testing USSS user:', mocks.mockUSSSUser);
      const filter = { first: 0, rows: 50 };
      const { predictions } = await predictionRoutes.getPredictions(filter, mocks.mockUSSSUser);
  
      console.log(`Got ${predictions.length} predictions for USSS user`);
      console.log('First prediction agency:', predictions[0]?.agency);
      console.log('Mapped agency:', predictionRoutes.mapAgency(predictions[0]?.agency));
  
      expect(predictions.length).toBeGreaterThan(0);
      predictions.forEach(pred => {
        const mappedAgency = predictionRoutes.mapAgency(pred.agency);
        console.log(`Original agency: ${pred.agency}, Mapped to: ${mappedAgency}`);
        expect(mappedAgency).toBe(mocks.mockAgencies.USSS);
      });
    });
  });
  
  // Agency lookup configuration
  const AGENCY_LOOKUP = {
    "department of test": "TEST, DEPARTMENT OF",
    "department of agriculture": "Department of Agriculture",
    "department of commerce": "Department of Commerce",
    "department of defense": "Department of Defense",
    "department of education": "Department of Education",
    "department of health and human services": "Department of Health and Human Services",
    "department of homeland security": "Department of Homeland Security",
    "department of housing and urban development": "Department of Housing and Urban Development",
    "department of justice": "Department of Justice",
    "department of labor": "Department of Labor",
    "department of state": "Department of State",
    "department of the interior": "Department of the Interior",
    "department of the treasury": "Department of the Treasury",
    "department of transportation": "Department of Transportation",
    "environmental protection agency": "Environmental Protection Agency",
    "executive office of the president": "Executive Office of the President",
    "general services administration": "General Services Administration",
    "department of defense--military programs": "Department of Defense",
    "millennium challenge corporation": "Millennium Challenge Corporation",
    "army": "DEPT OF THE ARMY",
    "navy": "DEPT OF THE NAVY",
    "af": "DEPT OF THE AIR FORCE",
    "spaceforce": "SPACE FORCE",
    "dla": "DEFENSE LOGISTICS AGENCY",
    "ihs": "INDIAN HEALTH SERVICE",
    "usss": "US SECRET SERVICE",
    "usmint": "US MINT",
  };