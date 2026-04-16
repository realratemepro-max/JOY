# Simplified Pricing System - Implementation Status

## ✅ What's Done

### 1. Database Structure
- ✅ Created 2-plan system (FREE and PRO) in Firestore
- ✅ Deleted old 6-plan system
- ✅ Created feature definitions collection
- ✅ Uploaded simplified pricing data

### 2. TypeScript Types
- ✅ Updated `PricingPlan` interface to support new structure
- ✅ Created `PlanFeatures` interface with 21 feature flags
- ✅ Created `FeatureDefinition` interface for admin panel

### 3. Feature Flags Defined
21 features total:
- **Core**: publicProfile, receiveReviews, claimPlaces, displayProfessionals
- **Limits**: workplaceLimit, profileLimit, placeLimit
- **Analytics**: basicStats, advancedStats
- **Marketing**: shareToSocial
- **Customization**: customQuestions, customBranding, removeRealRateMeBranding
- **Integration**: websiteWidget, googleReviewsIntegration, apiAccess
- **Support**: prioritySupport
- **Data**: exportData
- **Content**: premiumPhotos, openingHours
- **Advanced**: multipleLocations, teamManagement

### 4. Admin Panel
- ✅ Created AdminFeatures page for toggling features
- ✅ Added "Funcionalidades" tab to admin panel
- ⚠️  Has TypeScript errors (needs fixing)

## ❌ What's NOT Done

### 1. Page Updates Needed
The following pages still expect old pricing format and need updating:
- ❌ `AdminPricing.tsx` - expects `category` and `features` as array
- ❌ `Pricing.tsx` - public pricing page, expects old format
- ❌ `Checkout.tsx` - checkout page, expects old format

### 2. Feature Enforcement
- ❌ NO plan enforcement exists anywhere
- ❌ Need middleware to check user's plan before allowing features
- ❌ Need UI components to show "upgrade to PRO" prompts
- ❌ Need to connect subscriptions to feature access

### 3. Payment System Updates
- ❌ Payment system creates subscriptions but doesn't enforce limits
- ❌ Need to update payment flow for new 2-plan system
- ❌ Need to handle plan in User document (not per-profile)

## 🔧 What Needs To Be Fixed Now

### Immediate Fixes Required:
1. **Fix TypeScript Errors** -
   The old pages expect features as `PlanFeature[]`, new system uses `PlanFeatures` object

2. **Create Migration Strategy**:
   - Option A: Keep both formats temporarily (add compatibility layer)
   - Option B: Update all pages at once to new format
   - Option C: Create new pages, deprecate old ones

### Recommended Next Steps:
1. **Fix AdminFeatures TypeScript errors**
2. **Create new simplified Pricing page** that works with new format
3. **Build plan enforcement hook** (`usePlanAccess()`)
4. **Update payment flow** to use new 2-plan system
5. **Add upgrade prompts** throughout the app

## 📊 Current Pricing Data in Firestore

```javascript
// Collection: pricing
{
  "free": {
    id: "free",
    name: "FREE",
    namePt: "GRÁTIS",
    priceAnnual: 0,
    priceMonthly: 0,
    features: {
      publicProfile: true,
      receiveReviews: true,
      basicStats: true,
      workplaceLimit: 2,
      profileLimit: 1,
      placeLimit: 1,
      // ... all other features false or limited
    }
  },
  "pro": {
    id: "pro",
    name: "PRO",
    namePt: "PRO",
    priceAnnual: 49.99,
    priceMonthly: 4.99,
    features: {
      // All features true
      // All limits set to -1 (unlimited)
    }
  }
}

// Collection: featureDefinitions
{
  "features": {
    publicProfile: { name, namePt, description, descriptionPt, category },
    receiveReviews: { ... },
    // ... all 21 features
  }
}
```

## 🎯 End Goal

**User Experience:**
- User registers → Gets FREE plan automatically
- User can create 1 professional profile, 1 place, 2 workplaces (FREE limits)
- When they try to exceed limits → "Upgrade to PRO" prompt
- User pays → Subscription created → ALL their profiles/places get PRO features
- PRO users get unlimited everything + all advanced features

**Admin Experience:**
- Admin can toggle which features are in FREE vs PRO
- Admin can adjust limits (workplaces, profiles, places)
- Admin can see all subscriptions and payments
- Admin can manage promo codes

## 📝 Notes

- The system is halfway migrated - database is updated but frontend still expects old format
- Need to decide: gradual migration or all-at-once update?
- Current build FAILS due to TypeScript errors from format mismatch
