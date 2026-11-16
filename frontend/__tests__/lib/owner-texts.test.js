/**
 * Texts to the owner of a lost report (app/lib/sms.js).
 *
 * The lost wizard's default is "Text me", and it promises "We text you when
 * someone reports a sighting". Sightings reached the owner by bell, push and
 * email only, and the SMS sighting helpers were never called. Now a sighting
 * texts an owner who asked for texts, when texts can be sent at all, a few an
 * hour, and says it went only when Twilio took it.
 */

const mockCreate = jest.fn();
jest.mock('twilio', () => jest.fn(() => ({ messages: { create: (...args) => mockCreate(...args) } })));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findUnique: jest.fn() },
    smsLog: { count: jest.fn(), create: jest.fn(async () => ({})) },
  },
}));
jest.mock('@/app/lib/config', () => ({ __esModule: true, getEmailBaseUrl: () => 'https://reunitepets.test' }));

const PHONE_ONLY = {
  ownerEmail: 'Not provided',
  ownerPhone: '(512) 555-0142',
  reporter: { id: 'u-owner', email: 'p5125550142@phone-only.invalid', phone: '(512) 555-0142', smsPreferences: null },
};
const BY_EMAIL = { ownerEmail: 'avery@example.com', ownerPhone: 'Not provided', reporter: { id: 'u-avery', email: 'avery@example.com', phone: null, smsPreferences: null } };

function load({ configured = true } = {}) {
  let mod;
  jest.isolateModules(() => {
    if (configured) {
      process.env.TWILIO_ACCOUNT_SID = 'AC-test';
      process.env.TWILIO_AUTH_TOKEN = 'token';
      process.env.TWILIO_PHONE_NUMBER = '+15125550000';
    } else {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_PHONE_NUMBER;
    }
    mod = require('@/app/lib/sms');
  });
  return { sms: mod, prisma: require('@/app/lib/prisma').default };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({ sid: 'SM1' });
});

afterAll(() => {
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_PHONE_NUMBER;
});

describe('who is texted', () => {
  test('an owner who reported with "Text me" is texted on the number they gave', () => {
    const { sms } = load();
    expect(sms.ownerTextNumber(PHONE_ONLY)).toBe('+15125550142');
  });

  test('an owner who gave an email is not texted, unless they turned sighting texts on for a confirmed phone', () => {
    const { sms } = load();
    expect(sms.ownerTextNumber(BY_EMAIL)).toBeNull();
    const optedIn = { ...BY_EMAIL, reporter: { ...BY_EMAIL.reporter, smsPreferences: { phoneNumber: '+15125550199', verified: true, sightingAlerts: true } } };
    expect(sms.ownerTextNumber(optedIn)).toBe('+15125550199');
    const unconfirmed = { ...BY_EMAIL, reporter: { ...BY_EMAIL.reporter, smsPreferences: { phoneNumber: '+15125550199', verified: false, sightingAlerts: true } } };
    expect(sms.ownerTextNumber(unconfirmed)).toBeNull();
  });

  test('"Not provided" is never a number', () => {
    const { sms } = load();
    expect(sms.ownerTextNumber({ ...PHONE_ONLY, ownerPhone: 'Not provided', reporter: { ...PHONE_ONLY.reporter, phone: null } })).toBeNull();
  });
});

describe('a sighting, texted', () => {
  test('goes to the owner who chose text, with the place and the link to the map, and says it went', async () => {
    const { sms, prisma } = load();
    prisma.case.findUnique.mockResolvedValue(PHONE_ONLY);
    prisma.smsLog.count.mockResolvedValue(0);
    const res = await sms.textOwnerAboutSighting({ caseId: 'case-1', title: 'Max was just seen', place: 'Ramsey Ave and W 40th St', url: '/mission-control?mission=AUS-1' });
    expect(res).toEqual({ sent: true });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const params = mockCreate.mock.calls[0][0];
    expect(params).toMatchObject({ to: '+15125550142', from: '+15125550000' });
    expect(params.body).toBe('ReunitePets: Max was just seen near Ramsey Ave and W 40th St. See where on the map: https://reunitepets.test/mission-control?mission=AUS-1');
    // The log's own fields are not sent to Twilio as message fields.
    expect(params).not.toHaveProperty('userId');
    expect(params).not.toHaveProperty('messageType');
    expect(prisma.smsLog.create.mock.calls[0][0].data).toMatchObject({ userId: 'u-owner', messageType: 'SIGHTING', status: 'SENT' });
  });

  test('is not sent, and not said to be, when texts are not set up', async () => {
    const { sms, prisma } = load({ configured: false });
    expect(await sms.textOwnerAboutSighting({ caseId: 'case-1', title: 'Max was just seen', url: '/x' })).toEqual({ sent: false, reason: 'SMS_NOT_CONFIGURED' });
    expect(prisma.case.findUnique).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('is not sent to an owner who chose email', async () => {
    const { sms, prisma } = load();
    prisma.case.findUnique.mockResolvedValue(BY_EMAIL);
    expect(await sms.textOwnerAboutSighting({ caseId: 'case-1', title: 'Max was just seen', url: '/x' })).toEqual({ sent: false, reason: 'NOT_ASKED' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('stops at a few an hour', async () => {
    const { sms, prisma } = load();
    prisma.case.findUnique.mockResolvedValue(PHONE_ONLY);
    prisma.smsLog.count.mockResolvedValue(sms.OWNER_TEXTS_PER_HOUR);
    expect(await sms.textOwnerAboutSighting({ caseId: 'case-1', title: 'Max was just seen', url: '/x' })).toEqual({ sent: false, reason: 'HOURLY_LIMIT' });
    expect(prisma.smsLog.count.mock.calls[0][0].where).toMatchObject({ userId: 'u-owner', messageType: 'SIGHTING', status: 'SENT' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('a text Twilio refused is a text that did not go', async () => {
    const { sms, prisma } = load();
    prisma.case.findUnique.mockResolvedValue(PHONE_ONLY);
    prisma.smsLog.count.mockResolvedValue(0);
    mockCreate.mockRejectedValue(Object.assign(new Error('Unverified number'), { code: 21610 }));
    const res = await sms.textOwnerAboutSighting({ caseId: 'case-1', title: 'Max was just seen', url: '/x' });
    expect(res.sent).toBe(false);
    expect(prisma.smsLog.create.mock.calls[0][0].data).toMatchObject({ status: 'FAILED' });
  });
});
