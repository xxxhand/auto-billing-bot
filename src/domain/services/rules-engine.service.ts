import { Rules } from '../entities/rules.entity';

/**
 * Rule evaluation context - contains data for rule evaluation
 */
export interface RuleEvaluationContext {
  userId?: string;
  productId?: string;
  product?: {
    productId: string;
    name: string;
    price: number;
    cycleType: string;
  };
  subscription?: {
    subscriptionId?: string;
    isFirstTimeSubscription?: boolean;
  };
  currentDate?: Date | string;
  originalPrice?: number;
  discountedPrice?: number;
  discountAmount?: number;
  discountApplied?: boolean;
  bonusAmount?: number;
  bonusAdded?: boolean;
  appliedRules?: string[];
  discountReason?: string;
  [key: string]: any;
}

/**
 * Rule evaluation result
 */
export interface RuleEvaluationResult {
  context: RuleEvaluationContext;
  appliedRules: string[];
  totalDiscount: number;
  totalBonus: number;
  success: boolean;
  errors?: string[];
}

/**
 * Domain service for handling dynamic business rules evaluation and execution
 * Implements rule engine logic for discount calculation, bonus application, and other business rules
 */
export class RulesEngineService {
  /**
   * Evaluate rules against a given context and return the processed result
   * Rules are evaluated in priority order, and actions are applied sequentially
   *
   * @param rules Array of rules to evaluate
   * @param context The evaluation context containing business data
   * @returns Evaluation result with modified context and applied rules
   */
  public evaluateRules(rules: Rules[], context: RuleEvaluationContext): RuleEvaluationResult {
    // Initialize result context with a copy of input context
    const resultContext: RuleEvaluationContext = {
      ...context,
      appliedRules: [],
      discountAmount: context.discountAmount || 0,
      bonusAmount: context.bonusAmount || 0,
      discountApplied: context.discountApplied || false,
      bonusAdded: context.bonusAdded || false,
    };

    const appliedRules: string[] = [];
    const errors: string[] = [];

    try {
      // Sort rules by priority (assuming higher priority number means higher priority)
      // For now, we'll evaluate in the order provided, but this can be enhanced
      const sortedRules = this.sortRulesByPriority(rules);

      // Evaluate each rule in order
      for (const rule of sortedRules) {
        try {
          if (rule.evaluateConditions(resultContext)) {
            // Rule conditions met, execute actions
            const updatedContext = rule.executeActions(resultContext);

            // Update result context
            Object.assign(resultContext, updatedContext);

            // Track applied rule
            appliedRules.push(rule.ruleId);
            resultContext.appliedRules = appliedRules;
          }
        } catch (error) {
          // Log error but continue with other rules
          const errorMessage = `Error evaluating rule ${rule.ruleId}: ${error.message}`;
          errors.push(errorMessage);
        }
      }
    } catch (error) {
      errors.push(`Error in rule evaluation: ${error.message}`);
    }

    return {
      context: resultContext,
      appliedRules,
      totalDiscount: resultContext.discountAmount || 0,
      totalBonus: resultContext.bonusAmount || 0,
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Filter rules by type and validity
   * Only returns rules that are applicable for the given type and are currently valid
   *
   * @param rules Array of all rules
   * @param ruleType The type of rules to filter (e.g., 'discount', 'billing')
   * @param currentDate Optional current date for validity checking (defaults to now)
   * @returns Filtered array of applicable rules
   */
  public filterApplicableRules(rules: Rules[], ruleType: string, currentDate?: Date): Rules[] {
    const now = currentDate || new Date();

    return rules.filter(rule => {
      // Check if rule type matches
      if (!rule.isApplicable(ruleType)) {
        return false;
      }

      // For now, we assume rules are always valid if they exist
      // This can be enhanced to check validity dates if needed
      return true;
    });
  }

  /**
   * Sort rules by priority
   * Higher priority rules are evaluated first
   * This is a placeholder implementation - actual priority logic may vary
   *
   * @param rules Array of rules to sort
   * @returns Sorted array of rules
   */
  private sortRulesByPriority(rules: Rules[]): Rules[] {
    // For now, sort by ruleId lexicographically
    // This can be enhanced to use actual priority fields if added to Rules entity
    return [...rules].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  }

  /**
   * Validate a set of rules for consistency and correctness
   * Checks for rule conflicts, circular dependencies, etc.
   *
   * @param rules Array of rules to validate
   * @returns Validation result with success status and any error messages
   */
  public validateRules(rules: Rules[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Check for duplicate rule IDs
      const ruleIds = rules.map(r => r.ruleId);
      const duplicateIds = ruleIds.filter((id, index) => ruleIds.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        errors.push(`Duplicate rule IDs found: ${duplicateIds.join(', ')}`);
      }

      // Validate each rule individually
      for (const rule of rules) {
        try {
          rule.validate();
        } catch (error) {
          errors.push(`Rule ${rule.ruleId} validation failed: ${error.message}`);
        }
      }

      // Check for potential conflicts (placeholder for future enhancement)
      // This could check for rules that might conflict with each other

    } catch (error) {
      errors.push(`Rule validation error: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}