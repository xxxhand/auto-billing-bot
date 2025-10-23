import { RulesEngineService, RuleEvaluationContext, RuleEvaluationResult } from './rules-engine.service';
import { Rules } from '../entities/rules.entity';

describe('RulesEngineService', () => {
  let service: RulesEngineService;

  beforeEach(() => {
    service = new RulesEngineService();
  });

  describe('evaluateRules', () => {
    it('should return unmodified context when no rules are provided', () => {
      // Arrange
      const rules: Rules[] = [];
      const context: RuleEvaluationContext = {
        userId: 'user_123',
        originalPrice: 100,
      };

      // Act
      const result = service.evaluateRules(rules, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.appliedRules).toEqual([]);
      expect(result.totalDiscount).toBe(0);
      expect(result.totalBonus).toBe(0);
      expect(result.context.userId).toBe('user_123');
      expect(result.context.originalPrice).toBe(100);
      expect(result.errors).toBeUndefined();
    });

    it('should apply single rule when conditions are met', () => {
      // Arrange
      const rule = new Rules(
        'discount_rule_1',
        'discount',
        { userId: 'user_123' },
        { discount: { type: 'fixed', value: 10 } }
      );

      const context: RuleEvaluationContext = {
        userId: 'user_123',
        originalPrice: 100,
      };

      // Act
      const result = service.evaluateRules([rule], context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.appliedRules).toEqual(['discount_rule_1']);
      expect(result.totalDiscount).toBe(10);
      expect(result.context.discountApplied).toBe(true);
      expect(result.context.finalPrice).toBe(90);
    });

    it('should not apply rule when conditions are not met', () => {
      // Arrange
      const rule = new Rules(
        'discount_rule_1',
        'discount',
        { userId: 'user_456' }, // Different user
        { discount: { type: 'fixed', value: 10 } }
      );

      const context: RuleEvaluationContext = {
        userId: 'user_123',
        originalPrice: 100,
      };

      // Act
      const result = service.evaluateRules([rule], context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.appliedRules).toEqual([]);
      expect(result.totalDiscount).toBe(0);
      expect(result.context.discountApplied).toBe(false);
    });

    it('should apply multiple rules in sequence', () => {
      // Arrange
      const rule1 = new Rules(
        'discount_rule_1',
        'discount',
        { userId: 'user_123' },
        { discount: { type: 'fixed', value: 10 } }
      );

      const rule2 = new Rules(
        'bonus_rule_1',
        'bonus',
        { originalPrice: { operator: 'gt', value: 50 } },
        { addBonus: { type: 'bonus', value: 5 } }
      );

      const context: RuleEvaluationContext = {
        userId: 'user_123',
        originalPrice: 100,
      };

      // Act
      const result = service.evaluateRules([rule1, rule2], context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.appliedRules).toEqual(['bonus_rule_1', 'discount_rule_1']); // Sorted by ruleId
      expect(result.totalDiscount).toBe(10);
      expect(result.totalBonus).toBe(5);
      expect(result.context.discountApplied).toBe(true);
      expect(result.context.bonusAdded).toBe(true);
    });

    it('should handle operator conditions correctly', () => {
      // Arrange
      const rule = new Rules(
        'price_rule',
        'discount',
        {
          originalPrice: { operator: 'gte', value: 200 },
          'product.cycleType': 'yearly'
        },
        { discount: { type: 'percentage', value: 20 } }
      );

      const context: RuleEvaluationContext = {
        originalPrice: 250,
        product: { cycleType: 'yearly', productId: 'prod_123', name: 'Yearly Plan', price: 250 },
      };

      // Act
      const result = service.evaluateRules([rule], context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.appliedRules).toEqual(['price_rule']);
      expect(result.totalDiscount).toBe(50); // 20% of 250
      expect(result.context.finalPrice).toBe(200);
    });

    it('should handle array conditions (in operator)', () => {
      // Arrange
      const rule = new Rules(
        'product_rule',
        'discount',
        { productId: ['prod_123', 'prod_456', 'prod_789'] },
        { discount: { type: 'fixed', value: 15 } }
      );

      const context: RuleEvaluationContext = {
        productId: 'prod_456',
        originalPrice: 100,
      };

      // Act
      const result = service.evaluateRules([rule], context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.appliedRules).toEqual(['product_rule']);
      expect(result.totalDiscount).toBe(15);
    });

    it('should apply only the highest priority discount rule (single discount principle)', () => {
      // Arrange - Create two discount rules with same priority (will be sorted by ruleId)
      const rule1 = new Rules(
        'discount_10',
        'discount',
        { userId: 'user_123' },
        { discount: { type: 'fixed', value: 10 } }
      );

      const rule2 = new Rules(
        'discount_5_percent',
        'discount',
        { originalPrice: { operator: 'gte', value: 50 } },
        { discount: { type: 'percentage', value: 5 } }
      );

      const context: RuleEvaluationContext = {
        userId: 'user_123',
        originalPrice: 100,
      };

      // Act
      const result = service.evaluateRules([rule1, rule2], context);

      // Assert - Only the highest priority rule (discount_10, lexicographically first) should be applied
      expect(result.success).toBe(true);
      expect(result.appliedRules).toEqual(['discount_10']); // Only one rule applied
      expect(result.totalDiscount).toBe(10); // Only the fixed discount of 10
      expect(result.context.finalPrice).toBe(90); // 100 - 10
    });

    it('should handle rule evaluation errors gracefully', () => {
      // Arrange - Create a rule that will cause an error during evaluation
      const mockRule = new Rules('error_rule', 'discount', {}, {});
      // Mock the evaluateConditions method to throw an error
      jest.spyOn(mockRule, 'evaluateConditions').mockImplementation(() => {
        throw new Error('Evaluation error');
      });

      const context: RuleEvaluationContext = {
        userId: 'user_123',
        originalPrice: 100,
      };

      // Act
      const result = service.evaluateRules([mockRule], context);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Error evaluating rule error_rule: Evaluation error');
      expect(result.appliedRules).toEqual([]);
    });

    it('should handle complex nested context evaluation', () => {
      // Arrange
      const rule = new Rules(
        'complex_rule',
        'discount',
        {
          'subscription.isFirstTimeSubscription': true,
          'product.cycleType': 'yearly',
          currentDate: { operator: 'lt', value: '2026-12-31T23:59:59Z' }
        },
        { discount: { type: 'fixed', value: 1000 } }
      );

      const context: RuleEvaluationContext = {
        userId: 'user_123',
        subscription: {
          subscriptionId: 'sub_123',
          isFirstTimeSubscription: true,
        },
        product: {
          productId: 'yearly_plan',
          name: 'Yearly Plan',
          price: 2000,
          cycleType: 'yearly',
        },
        currentDate: '2025-10-22T10:00:00Z', // Use string format for comparison
        originalPrice: 2000,
      };

      // Act
      const result = service.evaluateRules([rule], context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.appliedRules).toEqual(['complex_rule']);
      expect(result.totalDiscount).toBe(1000);
      expect(result.context.finalPrice).toBe(1000);
    });
  });

  describe('filterApplicableRules', () => {
    it('should filter rules by type', () => {
      // Arrange
      const discountRule = new Rules('discount_1', 'discount', {}, {});
      const billingRule = new Rules('billing_1', 'billing', {}, {});
      const validationRule = new Rules('validation_1', 'validation', {}, {});

      const rules = [discountRule, billingRule, validationRule];

      // Act
      const discountRules = service.filterApplicableRules(rules, 'discount');

      // Assert
      expect(discountRules).toHaveLength(1);
      expect(discountRules[0]).toBe(discountRule);
    });

    it('should return empty array when no rules match type', () => {
      // Arrange
      const discountRule = new Rules('discount_1', 'discount', {}, {});
      const billingRule = new Rules('billing_1', 'billing', {}, {});

      const rules = [discountRule, billingRule];

      // Act
      const validationRules = service.filterApplicableRules(rules, 'validation');

      // Assert
      expect(validationRules).toHaveLength(0);
    });

    it('should return all rules of matching type', () => {
      // Arrange
      const discountRule1 = new Rules('discount_1', 'discount', {}, {});
      const discountRule2 = new Rules('discount_2', 'discount', {}, {});
      const billingRule = new Rules('billing_1', 'billing', {}, {});

      const rules = [discountRule1, discountRule2, billingRule];

      // Act
      const discountRules = service.filterApplicableRules(rules, 'discount');

      // Assert
      expect(discountRules).toHaveLength(2);
      expect(discountRules).toContain(discountRule1);
      expect(discountRules).toContain(discountRule2);
    });
  });

  describe('validateRules', () => {
    it('should validate empty rule set as valid', () => {
      // Arrange
      const rules: Rules[] = [];

      // Act
      const result = service.validateRules(rules);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid rules as valid', () => {
      // Arrange
      const validRule = new Rules('valid_rule', 'discount', { userId: 'test' }, { discount: { type: 'fixed', value: 10 } });
      const rules = [validRule];

      // Act
      const result = service.validateRules(rules);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate rule IDs', () => {
      // Arrange
      const rule1 = new Rules('duplicate_id', 'discount', {}, {});
      const rule2 = new Rules('duplicate_id', 'billing', {}, {});
      const rules = [rule1, rule2];

      // Act
      const result = service.validateRules(rules);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate rule IDs found: duplicate_id');
    });

    it('should detect invalid individual rules', () => {
      // Arrange - Create a rule that will fail validation by mocking the validate method
      const invalidRule = new Rules('test_rule', 'discount', {}, {});
      // Mock the validate method to throw an error
      jest.spyOn(invalidRule, 'validate').mockImplementation(() => {
        throw new Error('Mock validation error');
      });

      const rules = [invalidRule];

      // Act
      const result = service.validateRules(rules);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Rule test_rule validation failed: Mock validation error');
    });

    it('should handle validation errors gracefully', () => {
      // Arrange
      const validRule = new Rules('valid_rule', 'discount', {}, {});
      const invalidRule1 = new Rules('invalid_rule_1', 'discount', {}, {});
      const invalidRule2 = new Rules('invalid_rule_2', 'billing', {}, {});

      // Mock validation methods to throw errors
      jest.spyOn(invalidRule1, 'validate').mockImplementation(() => {
        throw new Error('Validation error 1');
      });
      jest.spyOn(invalidRule2, 'validate').mockImplementation(() => {
        throw new Error('Validation error 2');
      });

      const rules = [validRule, invalidRule1, invalidRule2];

      // Act
      const result = service.validateRules(rules);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Rule invalid_rule_1 validation failed: Validation error 1');
      expect(result.errors).toContain('Rule invalid_rule_2 validation failed: Validation error 2');
    });
  });

  describe('integration scenarios', () => {
    it('should handle first-time yearly subscription discount scenario', () => {
      // Arrange - Recreate the scenario from system design
      const firstTimeYearlyDiscountRule = new Rules(
        'first_time_yearly_discount',
        'discount',
        {
          'subscription.isFirstTimeSubscription': true,
          'product.cycleType': 'yearly',
          currentDate: { operator: 'lt', value: '2026-12-31T23:59:59Z' }
        },
        { discount: { type: 'fixed', value: 1000 } }
      );

      const context: RuleEvaluationContext = {
        userId: 'user_123',
        subscription: {
          subscriptionId: 'sub_123',
          isFirstTimeSubscription: true,
        },
        product: {
          productId: 'yearly_plan',
          name: 'Yearly Plan',
          price: 2000,
          cycleType: 'yearly',
        },
        currentDate: '2025-10-22T10:00:00Z', // Use string format for comparison
        originalPrice: 2000,
      };

      // Act
      const result = service.evaluateRules([firstTimeYearlyDiscountRule], context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.appliedRules).toEqual(['first_time_yearly_discount']);
      expect(result.totalDiscount).toBe(1000);
      expect(result.context.finalPrice).toBe(1000);
      expect(result.context.discountReason).toBeUndefined(); // Not implemented in current Rules entity
    });

    it('should handle complex multi-condition rules', () => {
      // Arrange
      const complexRule = new Rules(
        'complex_discount',
        'discount',
        {
          userId: { operator: 'in', value: ['vip_user_1', 'vip_user_2'] },
          'product.cycleType': 'yearly',
          originalPrice: { operator: 'gte', value: 1000 },
          'subscription.isFirstTimeSubscription': false
        },
        { discount: { type: 'percentage', value: 15 } }
      );

      const context: RuleEvaluationContext = {
        userId: 'vip_user_1',
        subscription: {
          subscriptionId: 'sub_123',
          isFirstTimeSubscription: false,
        },
        product: {
          productId: 'yearly_plan',
          name: 'Yearly Plan',
          price: 2000,
          cycleType: 'yearly',
        },
        originalPrice: 2000,
      };

      // Act
      const result = service.evaluateRules([complexRule], context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.appliedRules).toEqual(['complex_discount']);
      expect(result.totalDiscount).toBe(300); // 15% of 2000
      expect(result.context.finalPrice).toBe(1700);
    });

    it('should not apply rule when any condition fails', () => {
      // Arrange
      const strictRule = new Rules(
        'strict_discount',
        'discount',
        {
          userId: 'user_123',
          'product.cycleType': 'yearly',
          originalPrice: { operator: 'gte', value: 1000 },
          'subscription.isFirstTimeSubscription': true
        },
        { discount: { type: 'fixed', value: 500 } }
      );

      const context: RuleEvaluationContext = {
        userId: 'user_123',
        subscription: {
          subscriptionId: 'sub_123',
          isFirstTimeSubscription: false, // This condition fails
        },
        product: {
          productId: 'yearly_plan',
          name: 'Yearly Plan',
          price: 2000,
          cycleType: 'yearly',
        },
        originalPrice: 2000,
      };

      // Act
      const result = service.evaluateRules([strictRule], context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.appliedRules).toEqual([]);
      expect(result.totalDiscount).toBe(0);
      expect(result.context.discountApplied).toBe(false);
    });
  });
});