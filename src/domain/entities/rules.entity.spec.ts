import { Rules } from './rules.entity';

describe('Rules Entity', () => {
  describe('constructor', () => {
    it('should create a rules entity with valid parameters', () => {
      // Arrange
      const ruleId = 'rule_123';
      const type = 'billing';
      const conditions = { productType: 'yearly', userType: 'new' };
      const actions = { discount: { type: 'percentage', value: 10 } };

      // Act
      const rule = new Rules(ruleId, type, conditions, actions);

      // Assert
      expect(rule.ruleId).toBe(ruleId);
      expect(rule.type).toBe(type);
      expect(rule.conditions).toEqual(conditions);
      expect(rule.actions).toEqual(actions);
    });

    it('should throw error for empty ruleId', () => {
      // Act & Assert
      expect(() => {
        new Rules('', 'billing', {}, {});
      }).toThrow('Rule ID cannot be empty');
    });

    it('should throw error for empty type', () => {
      // Act & Assert
      expect(() => {
        new Rules('rule_123', '', {}, {});
      }).toThrow('Rule type cannot be empty');
    });
  });

  describe('evaluateConditions', () => {
    it('should return true when all conditions are met', () => {
      // Arrange
      const conditions = {
        productType: 'yearly',
        userType: 'new',
        amount: { operator: 'gte', value: 1000 }
      };
      const rule = new Rules('rule_123', 'billing', conditions, {});

      const context = {
        productType: 'yearly',
        userType: 'new',
        amount: 1200
      };

      // Act
      const result = rule.evaluateConditions(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when any condition is not met', () => {
      // Arrange
      const conditions = {
        productType: 'yearly',
        userType: 'new'
      };
      const rule = new Rules('rule_123', 'billing', conditions, {});

      const context = {
        productType: 'monthly', // Different value
        userType: 'new'
      };

      // Act
      const result = rule.evaluateConditions(context);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle operator conditions correctly', () => {
      // Arrange
      const conditions = {
        amount: { operator: 'gte', value: 1000 },
        count: { operator: 'lt', value: 5 }
      };
      const rule = new Rules('rule_123', 'billing', conditions, {});

      // Act & Assert
      expect(rule.evaluateConditions({ amount: 1200, count: 3 })).toBe(true); // Both conditions met
      expect(rule.evaluateConditions({ amount: 800, count: 3 })).toBe(false); // Amount too low
      expect(rule.evaluateConditions({ amount: 1200, count: 7 })).toBe(false); // Count too high
    });

    it('should handle array conditions (in operator)', () => {
      // Arrange
      const conditions = {
        productType: ['yearly', 'quarterly'],
        userType: 'new'
      };
      const rule = new Rules('rule_123', 'billing', conditions, {});

      // Act & Assert
      expect(rule.evaluateConditions({ productType: 'yearly', userType: 'new' })).toBe(true);
      expect(rule.evaluateConditions({ productType: 'monthly', userType: 'new' })).toBe(false);
    });

    it('should return true for empty conditions', () => {
      // Arrange
      const rule = new Rules('rule_123', 'billing', {}, {});

      // Act
      const result = rule.evaluateConditions({ any: 'context' });

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('executeActions', () => {
    it('should execute discount action correctly', () => {
      // Arrange
      const actions = {
        discount: {
          type: 'percentage',
          value: 10
        }
      };
      const rule = new Rules('rule_123', 'billing', {}, actions);

      const context = {
        originalPrice: 1000,
        appliedDiscounts: []
      };

      // Act
      const result = rule.executeActions(context);

      // Assert
      expect(result.discountApplied).toBe(true);
      expect(result.discountAmount).toBe(100);
      expect(result.finalPrice).toBe(900);
    });

    it('should execute fixed amount discount action', () => {
      // Arrange
      const actions = {
        discount: {
          type: 'fixed',
          value: 50
        }
      };
      const rule = new Rules('rule_123', 'billing', {}, actions);

      const context = {
        originalPrice: 200,
        appliedDiscounts: []
      };

      // Act
      const result = rule.executeActions(context);

      // Assert
      expect(result.discountApplied).toBe(true);
      expect(result.discountAmount).toBe(50);
      expect(result.finalPrice).toBe(150);
    });

    it('should handle multiple actions', () => {
      // Arrange
      const actions = {
        discount: { type: 'percentage', value: 10 },
        addBonus: { type: 'bonus', value: 100 }
      };
      const rule = new Rules('rule_123', 'billing', {}, actions);

      const context = {
        originalPrice: 1000,
        appliedDiscounts: []
      };

      // Act
      const result = rule.executeActions(context);

      // Assert
      expect(result.discountApplied).toBe(true);
      expect(result.discountAmount).toBe(100);
      expect(result.finalPrice).toBe(900);
      expect(result.bonusAdded).toBe(true);
      expect(result.bonusAmount).toBe(100);
    });

    it('should return unmodified context when no actions defined', () => {
      // Arrange
      const rule = new Rules('rule_123', 'billing', {}, {});

      const context = {
        originalPrice: 1000
      };

      // Act
      const result = rule.executeActions(context);

      // Assert
      expect(result).toEqual(context);
    });
  });

  describe('isApplicable', () => {
    it('should return true for matching rule type', () => {
      // Arrange
      const rule = new Rules('rule_123', 'billing', {}, {});

      // Act & Assert
      expect(rule.isApplicable('billing')).toBe(true);
      expect(rule.isApplicable('discount')).toBe(false);
    });

    it('should be case sensitive for rule type matching', () => {
      // Arrange
      const rule = new Rules('rule_123', 'Billing', {}, {});

      // Act & Assert
      expect(rule.isApplicable('billing')).toBe(false);
      expect(rule.isApplicable('Billing')).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate a correct rule without throwing errors', () => {
      // Arrange
      const rule = new Rules('rule_123', 'billing', { productType: 'yearly' }, { discount: { type: 'percentage', value: 10 } });

      // Act & Assert
      expect(() => rule.validate()).not.toThrow();
    });

    it('should throw error for rule without conditions or actions', () => {
      // Arrange
      const rule = new Rules('rule_123', 'billing', {}, {});

      // Act & Assert
      expect(() => rule.validate()).toThrow('Rule must have at least one condition or action');
    });

    it('should validate discount action structure', () => {
      // Arrange
      const rule = new Rules('rule_123', 'billing', { productType: 'yearly' }, {
        discount: { type: 'invalid', value: 10 }
      });

      // Act & Assert
      expect(() => rule.validate()).toThrow('Invalid discount type: invalid');
    });

    it('should validate operator conditions', () => {
      // Arrange
      const rule = new Rules('rule_123', 'billing', {
        amount: { operator: 'invalid', value: 100 }
      }, { discount: { type: 'percentage', value: 10 } });

      // Act & Assert
      expect(() => rule.validate()).toThrow('Invalid operator: invalid');
    });
  });

  describe('getDescription', () => {
    it('should generate description for discount rule', () => {
      // Arrange
      const rule = new Rules('rule_123', 'billing', {
        productType: 'yearly',
        userType: 'new'
      }, {
        discount: { type: 'percentage', value: 15 }
      });

      // Act
      const description = rule.getDescription();

      // Assert
      expect(description).toContain('billing rule');
      expect(description).toContain('15% discount');
      expect(description).toContain('productType=yearly');
      expect(description).toContain('userType=new');
    });

    it('should generate description for rule without actions', () => {
      // Arrange
      const rule = new Rules('rule_123', 'validation', {
        amount: { operator: 'gte', value: 100 }
      }, {});

      // Act
      const description = rule.getDescription();

      // Assert
      expect(description).toContain('validation rule');
      expect(description).toContain('amount >= 100');
    });
  });

  describe('clone', () => {
    it('should create a deep copy of the rule', () => {
      // Arrange
      const originalRule = new Rules('rule_123', 'billing', {
        productType: 'yearly',
        nested: { value: 100 }
      }, {
        discount: { type: 'percentage', value: 10 }
      });

      // Act
      const clonedRule = originalRule.clone();

      // Assert
      expect(clonedRule.ruleId).toBe(originalRule.ruleId);
      expect(clonedRule.type).toBe(originalRule.type);
      expect(clonedRule.conditions).toEqual(originalRule.conditions);
      expect(clonedRule.actions).toEqual(originalRule.actions);
      expect(clonedRule).not.toBe(originalRule); // Different object reference
      expect(clonedRule.conditions).not.toBe(originalRule.conditions); // Deep copy
    });

    it('should allow creating clone with new ruleId', () => {
      // Arrange
      const originalRule = new Rules('rule_123', 'billing', {}, {});

      // Act
      const clonedRule = originalRule.clone('rule_456');

      // Assert
      expect(clonedRule.ruleId).toBe('rule_456');
      expect(clonedRule.type).toBe(originalRule.type);
    });
  });
});