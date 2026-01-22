/**
 * Phase 27: Insurance Integration
 * Pet insurance claims, theft/loss verification, reward coverage
 */

// Supported insurance providers
export const INSURANCE_PROVIDERS = {
  PETPLAN: {
    id: 'petplan',
    name: 'Petplan',
    apiUrl: 'https://api.gopetplan.com',
    coverageTypes: ['LOST_PET', 'THEFT', 'REWARD'],
  },
  TRUPANION: {
    id: 'trupanion',
    name: 'Trupanion',
    apiUrl: 'https://api.trupanion.com',
    coverageTypes: ['LOST_PET', 'ADVERTISING'],
  },
  NATIONWIDE: {
    id: 'nationwide',
    name: 'Nationwide Pet Insurance',
    apiUrl: 'https://api.petinsurance.com',
    coverageTypes: ['LOST_PET', 'THEFT', 'REWARD', 'SEARCH_EXPENSES'],
  },
  HEALTHY_PAWS: {
    id: 'healthy_paws',
    name: 'Healthy Paws',
    apiUrl: 'https://api.healthypawspetinsurance.com',
    coverageTypes: ['ADVERTISING'],
  },
  EMBRACE: {
    id: 'embrace',
    name: 'Embrace Pet Insurance',
    apiUrl: 'https://api.embracepetinsurance.com',
    coverageTypes: ['LOST_PET', 'REWARD'],
  },
};

// Claim types
export const CLAIM_TYPES = {
  LOST_PET_ADVERTISING: {
    id: 'lost_pet_advertising',
    name: 'Lost Pet Advertising',
    description: 'Coverage for flyers, posters, and online ads',
    maxAmount: 500,
  },
  REWARD_REIMBURSEMENT: {
    id: 'reward_reimbursement',
    name: 'Reward Reimbursement',
    description: 'Reimbursement for reward paid to finder',
    maxAmount: 1000,
  },
  SEARCH_EXPENSES: {
    id: 'search_expenses',
    name: 'Search Expenses',
    description: 'Professional search services, equipment rental',
    maxAmount: 1500,
  },
  THEFT_CLAIM: {
    id: 'theft_claim',
    name: 'Pet Theft',
    description: 'Coverage for stolen pet value',
    maxAmount: 5000,
  },
  TRANSPORT_REUNION: {
    id: 'transport_reunion',
    name: 'Transport for Reunion',
    description: 'Travel costs to retrieve found pet',
    maxAmount: 500,
  },
};

/**
 * Check insurance coverage for lost pet
 */
export async function checkInsuranceCoverage(policyData) {
  const { policyNumber, provider, petId } = policyData;

  const providerConfig = INSURANCE_PROVIDERS[provider.toUpperCase()];

  if (!providerConfig) {
    return {
      covered: false,
      error: 'Insurance provider not supported',
    };
  }

  // Verify policy with provider
  const policyDetails = await verifyPolicy(providerConfig, policyNumber);

  if (!policyDetails.active) {
    return {
      covered: false,
      reason: 'Policy is not active',
      policyStatus: policyDetails.status,
    };
  }

  // Check coverage details
  const coverage = {
    policyNumber,
    provider: providerConfig.name,
    petName: policyDetails.petName,
    covered: true,
    coverageTypes: [],
    limits: {},
    deductible: policyDetails.deductible,
    policyExpiration: policyDetails.expirationDate,
  };

  for (const type of providerConfig.coverageTypes) {
    if (policyDetails.coverages?.includes(type)) {
      const claimType = Object.values(CLAIM_TYPES).find(ct =>
        ct.id.toUpperCase().includes(type)
      );

      if (claimType) {
        coverage.coverageTypes.push({
          type: claimType.id,
          name: claimType.name,
          description: claimType.description,
          maxAmount: policyDetails.limits?.[type] || claimType.maxAmount,
        });
        coverage.limits[type] = policyDetails.limits?.[type] || claimType.maxAmount;
      }
    }
  }

  return coverage;
}

/**
 * Submit insurance claim for lost pet expenses
 */
export async function submitInsuranceClaim(claimData) {
  const {
    policyNumber,
    provider,
    claimType,
    missionId,
    amount,
    description,
    receipts,
    supportingDocuments,
  } = claimData;

  const providerConfig = INSURANCE_PROVIDERS[provider.toUpperCase()];

  // Prepare claim
  const claim = {
    id: `CLM-${Date.now()}`,
    policyNumber,
    provider: providerConfig.id,
    type: claimType,
    caseReference: missionId,
    claimedAmount: amount,
    description,
    documents: [
      ...receipts.map(r => ({ type: 'receipt', url: r.url, amount: r.amount })),
      ...supportingDocuments.map(d => ({ type: d.type, url: d.url })),
    ],
    submittedAt: new Date().toISOString(),
    status: 'PENDING',
  };

  // Validate claim
  const validation = validateClaim(claim, CLAIM_TYPES[claimType.toUpperCase()]);

  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  // Submit to provider
  const response = await submitToProvider(providerConfig, claim);

  return {
    success: true,
    claimId: claim.id,
    providerClaimId: response.claimId,
    status: response.status,
    estimatedProcessingDays: response.estimatedDays || 14,
    trackingUrl: response.trackingUrl,
    nextSteps: response.nextSteps || [
      'Claim is under review',
      'You will be notified within 5-7 business days',
      'Additional documentation may be requested',
    ],
  };
}

/**
 * Generate verification document for insurance
 */
export async function generateVerificationDocument(missionId, documentType) {
  const missionData = await getCaseData(missionId);

  const document = {
    id: `DOC-${Date.now()}`,
    type: documentType,
    missionNumber: missionData.missionNumber,
    generatedAt: new Date().toISOString(),
    validFor: '30 days',
    content: {},
  };

  switch (documentType) {
    case 'LOSS_VERIFICATION':
      document.content = {
        title: 'Certificate of Lost Pet Report',
        petInfo: {
          name: missionData.petName,
          species: missionData.petSpecies,
          breed: missionData.petBreed,
          color: missionData.petColor,
          microchipId: missionData.microchipId,
        },
        incidentDetails: {
          dateReported: missionData.createdAt,
          lastSeenDate: missionData.lastSeenAt,
          lastSeenLocation: missionData.lastSeenAddress,
          circumstances: missionData.escapeScenario,
        },
        verification: {
          platform: 'ReunitePets.org',
          missionNumber: missionData.missionNumber,
          verificationCode: generateVerificationCode(missionId),
          verifyUrl: `https://reunitepets.org/verify/${missionData.missionNumber}`,
        },
      };
      break;

    case 'SEARCH_EXPENSES':
      document.content = {
        title: 'Search Expense Summary',
        missionNumber: missionData.missionNumber,
        expenses: await getSearchExpenses(missionId),
        totalAmount: 0, // Calculate from expenses
        receiptCount: 0,
      };
      break;

    case 'REWARD_PAYMENT':
      document.content = {
        title: 'Reward Payment Confirmation',
        missionNumber: missionData.missionNumber,
        rewardAmount: missionData.rewardAmount,
        paidTo: missionData.finderName,
        paymentDate: missionData.rewardPaidAt,
        paymentMethod: missionData.rewardPaymentMethod,
        transactionId: missionData.rewardTransactionId,
      };
      break;

    case 'REUNION_CONFIRMATION':
      document.content = {
        title: 'Pet Reunion Confirmation',
        petInfo: {
          name: missionData.petName,
          species: missionData.petSpecies,
        },
        timeline: {
          reportedLost: missionData.createdAt,
          reunited: missionData.resolvedAt,
          daysLost: Math.ceil(
            (new Date(missionData.resolvedAt) - new Date(missionData.createdAt)) / (1000 * 60 * 60 * 24)
          ),
        },
        verifiedBy: 'ReunitePets.org',
      };
      break;
  }

  // Generate PDF URL (in production, create actual PDF)
  document.pdfUrl = `https://reunitepets.org/api/documents/${document.id}/pdf`;
  document.qrCode = `https://reunitepets.org/verify/${document.id}`;

  return document;
}

/**
 * Track claim status
 */
export async function trackClaimStatus(claimId, provider) {
  const providerConfig = INSURANCE_PROVIDERS[provider.toUpperCase()];

  const status = await fetchClaimStatus(providerConfig, claimId);

  return {
    claimId,
    status: status.status, // PENDING, REVIEWING, APPROVED, DENIED, PAID
    statusHistory: status.history.map(h => ({
      status: h.status,
      date: h.date,
      notes: h.notes,
    })),
    currentStep: status.currentStep,
    totalSteps: status.totalSteps,
    estimatedCompletion: status.estimatedCompletion,
    approvedAmount: status.approvedAmount,
    paidAmount: status.paidAmount,
    denialReason: status.denialReason,
    nextAction: status.nextAction,
  };
}

/**
 * Calculate potential claim amounts
 */
export async function calculateClaimEstimate(missionId, expenses) {
  const missionData = await getCaseData(missionId);

  const estimate = {
    categories: [],
    totalEstimate: 0,
    coveredAmount: 0,
    uncoveredAmount: 0,
  };

  // Categorize expenses
  const categories = {
    advertising: { label: 'Advertising & Flyers', items: [], total: 0, covered: true },
    reward: { label: 'Reward Payment', items: [], total: 0, covered: true },
    search: { label: 'Search Services', items: [], total: 0, covered: true },
    transport: { label: 'Transport', items: [], total: 0, covered: true },
    other: { label: 'Other Expenses', items: [], total: 0, covered: false },
  };

  for (const expense of expenses) {
    const category = categorizeExpense(expense);
    categories[category].items.push(expense);
    categories[category].total += expense.amount;
  }

  // Apply limits
  for (const [key, category] of Object.entries(categories)) {
    const claimType = Object.values(CLAIM_TYPES).find(ct =>
      ct.id.toLowerCase().includes(key)
    );

    const maxAmount = claimType?.maxAmount || 0;
    const coveredAmount = Math.min(category.total, maxAmount);

    estimate.categories.push({
      name: category.label,
      itemCount: category.items.length,
      totalAmount: category.total,
      maxCoverage: maxAmount,
      coveredAmount: category.covered ? coveredAmount : 0,
      uncoveredAmount: category.total - coveredAmount,
    });

    estimate.totalEstimate += category.total;
    if (category.covered) {
      estimate.coveredAmount += coveredAmount;
    }
    estimate.uncoveredAmount += category.total - coveredAmount;
  }

  return estimate;
}

/**
 * Link insurance policy to pet
 */
export async function linkInsurancePolicy(petId, policyData) {
  const { policyNumber, provider, holderName } = policyData;

  // Verify policy
  const providerConfig = INSURANCE_PROVIDERS[provider.toUpperCase()];
  const verification = await verifyPolicy(providerConfig, policyNumber);

  if (!verification.active) {
    return {
      success: false,
      error: 'Policy could not be verified',
    };
  }

  // Store link
  const link = {
    petId,
    policyNumber,
    provider: providerConfig.id,
    providerName: providerConfig.name,
    holderName,
    verified: true,
    verifiedAt: new Date().toISOString(),
    expirationDate: verification.expirationDate,
    coverageTypes: verification.coverages,
  };

  return {
    success: true,
    link,
    coverage: await checkInsuranceCoverage({ policyNumber, provider, petId }),
  };
}

// Helper functions

async function verifyPolicy(provider, policyNumber) {
  // Simulated policy verification
  return {
    active: true,
    status: 'ACTIVE',
    petName: 'Buddy',
    holderName: 'John Doe',
    expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    coverages: ['LOST_PET', 'REWARD', 'ADVERTISING'],
    limits: {
      LOST_PET: 500,
      REWARD: 1000,
      ADVERTISING: 300,
    },
    deductible: 50,
  };
}

function validateClaim(claim, claimType) {
  const errors = [];

  if (!claim.policyNumber) {
    errors.push('Policy number is required');
  }

  if (claim.claimedAmount > (claimType?.maxAmount || 0)) {
    errors.push(`Claimed amount exceeds maximum coverage of $${claimType.maxAmount}`);
  }

  if (claim.documents.length === 0) {
    errors.push('At least one supporting document is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

async function submitToProvider(provider, claim) {
  return {
    claimId: `${provider.id.toUpperCase()}-${Date.now()}`,
    status: 'PENDING',
    estimatedDays: 14,
    trackingUrl: `https://${provider.id}.com/claims/${claim.id}`,
  };
}

async function getCaseData(missionId) {
  return {
    missionNumber: 'CHI-2024-001234',
    petName: 'Buddy',
    petSpecies: 'DOG',
    petBreed: 'Golden Retriever',
    petColor: 'Golden',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeenAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeenAddress: '123 Main St, Chicago, IL',
    escapeScenario: 'Door left open',
    resolvedAt: new Date().toISOString(),
    rewardAmount: 500,
  };
}

async function getSearchExpenses(missionId) {
  return [];
}

function generateVerificationCode(missionId) {
  return `VRF-${missionId.substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

async function fetchClaimStatus(provider, claimId) {
  return {
    status: 'REVIEWING',
    history: [
      { status: 'PENDING', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
      { status: 'REVIEWING', date: new Date().toISOString(), notes: 'Documents under review' },
    ],
    currentStep: 2,
    totalSteps: 4,
    estimatedCompletion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function categorizeExpense(expense) {
  const type = expense.type?.toLowerCase() || '';
  if (type.includes('flyer') || type.includes('poster') || type.includes('ad')) return 'advertising';
  if (type.includes('reward')) return 'reward';
  if (type.includes('search') || type.includes('professional')) return 'search';
  if (type.includes('travel') || type.includes('transport')) return 'transport';
  return 'other';
}

export default {
  INSURANCE_PROVIDERS,
  CLAIM_TYPES,
  checkInsuranceCoverage,
  submitInsuranceClaim,
  generateVerificationDocument,
  trackClaimStatus,
  calculateClaimEstimate,
  linkInsurancePolicy,
};
