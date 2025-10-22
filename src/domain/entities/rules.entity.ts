import { BaseEntity } from './base-entity.abstract';

/**
 * Supported operators for condition evaluation
 */
export type ConditionOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin';

/**
 * Supported discount types
 */
export type DiscountType = 'percentage' | 'fixed';

/**
 * Condition with operator
 */
export interface OperatorCondition {
  operator: ConditionOperator;
  value: any;
}

/**
 * Discount action
 */
export interface DiscountAction {
  type: DiscountType;
  value: number;
}

/**
 * Rules entity - handles dynamic business rules evaluation and execution
 */
export class Rules extends BaseEntity {
  public ruleId: string;
  public type: string;
  public conditions: Record<string, any>;
  public actions: Record<string, any>;

  constructor(ruleId: string, type: string, conditions: Record<string, any>, actions: Record<string, any>) {
    super();

    // Validate inputs
    if (!ruleId || ruleId.trim() === '') {
      throw new Error('Rule ID cannot be empty');
    }
    if (!type || type.trim() === '') {
      throw new Error('Rule type cannot be empty');
    }

    this.ruleId = ruleId;
    this.type = type;
    this.conditions = conditions;
    this.actions = actions;
  }

  /**
   * Evaluate if the rule conditions are met given a context
   * @param context The context data to evaluate against
   * @returns true if all conditions are met, false otherwise
   */
  public evaluateConditions(context: Record<string, any>): boolean {
    // If no conditions, always return true
    if (Object.keys(this.conditions).length === 0) {
      return true;
    }

    for (const [key, condition] of Object.entries(this.conditions)) {
      if (!this.evaluateSingleCondition(key, condition, context)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   * @param key The condition key
   * @param condition The condition value (can be simple value or operator condition)
   * @param context The context data
   * @returns true if condition is met, false otherwise
   */
  private evaluateSingleCondition(key: string, condition: any, context: Record<string, any>): boolean {
    const contextValue = context[key];

    // Handle operator conditions
    if (typeof condition === 'object' && condition !== null && 'operator' in condition) {
      return this.evaluateOperatorCondition(contextValue, condition as OperatorCondition);
    }

    // Handle array conditions (in operator)
    if (Array.isArray(condition)) {
      return condition.includes(contextValue);
    }

    // Handle simple equality
    return contextValue === condition;
  }

  /**
   * Evaluate operator-based conditions
   * @param contextValue The value from context
   * @param condition The operator condition
   * @returns true if condition is met, false otherwise
   */
  private evaluateOperatorCondition(contextValue: any, condition: OperatorCondition): boolean {
    const { operator, value } = condition;

    switch (operator) {
      case 'eq':
        return contextValue === value;
      case 'neq':
        return contextValue !== value;
      case 'gt':
        return contextValue > value;
      case 'gte':
        return contextValue >= value;
      case 'lt':
        return contextValue < value;
      case 'lte':
        return contextValue <= value;
      case 'in':
        return Array.isArray(value) && value.includes(contextValue);
      case 'nin':
        return Array.isArray(value) && !value.includes(contextValue);
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  /**
   * Execute the rule actions on a given context
   * @param context The context data to modify
   * @returns Modified context with action results
   */
  public executeActions(context: Record<string, any>): Record<string, any> {
    const result = { ...context };

    for (const [actionKey, actionValue] of Object.entries(this.actions)) {
      if (actionKey === 'discount') {
        this.executeDiscountAction(result, actionValue as DiscountAction);
      } else if (actionKey === 'addBonus') {
        this.executeBonusAction(result, actionValue as any);
      }
      // Add more action types as needed
    }

    return result;
  }

  /**
   * Execute discount action
   * @param context The context to modify
   * @param discountAction The discount action configuration
   */
  private executeDiscountAction(context: Record<string, any>, discountAction: DiscountAction): void {
    const { type, value } = discountAction;
    const originalPrice = context.originalPrice || 0;

    let discountAmount = 0;

    if (type === 'percentage') {
      discountAmount = Math.round((originalPrice * value) / 100);
    } else if (type === 'fixed') {
      discountAmount = Math.min(value, originalPrice); // Don't discount more than the price
    }

    context.discountApplied = true;
    context.discountAmount = (context.discountAmount || 0) + discountAmount;
    context.finalPrice = originalPrice - (context.discountAmount || 0);
  }

  /**
   * Execute bonus action
   * @param context The context to modify
   * @param bonusAction The bonus action configuration
   */
  private executeBonusAction(context: Record<string, any>, bonusAction: any): void {
    const { type, value } = bonusAction;

    if (type === 'bonus') {
      context.bonusAdded = true;
      context.bonusAmount = (context.bonusAmount || 0) + value;
    }
  }

  /**
   * Check if this rule is applicable for a given rule type
   * @param ruleType The rule type to check
   * @returns true if applicable, false otherwise
   */
  public isApplicable(ruleType: string): boolean {
    return this.type === ruleType;
  }

  /**
   * Validate the rule structure and logic
   * @throws Error if validation fails
   */
  public validate(): void {
    // Must have at least one condition or action
    if (Object.keys(this.conditions).length === 0 && Object.keys(this.actions).length === 0) {
      throw new Error('Rule must have at least one condition or action');
    }

    // Validate conditions
    for (const [key, condition] of Object.entries(this.conditions)) {
      if (typeof condition === 'object' && condition !== null && 'operator' in condition) {
        const operatorCondition = condition as OperatorCondition;
        if (!this.isValidOperator(operatorCondition.operator)) {
          throw new Error(`Invalid operator: ${operatorCondition.operator}`);
        }
      }
    }

    // Validate actions
    for (const [actionKey, actionValue] of Object.entries(this.actions)) {
      if (actionKey === 'discount') {
        this.validateDiscountAction(actionValue as DiscountAction);
      }
    }
  }

  /**
   * Check if operator is valid
   * @param operator The operator to validate
   * @returns true if valid, false otherwise
   */
  private isValidOperator(operator: string): boolean {
    const validOperators: ConditionOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'nin'];
    return validOperators.includes(operator as ConditionOperator);
  }

  /**
   * Validate discount action
   * @param discountAction The discount action to validate
   * @throws Error if validation fails
   */
  private validateDiscountAction(discountAction: DiscountAction): void {
    const { type, value } = discountAction;

    if (type !== 'percentage' && type !== 'fixed') {
      throw new Error(`Invalid discount type: ${type}`);
    }

    if (typeof value !== 'number' || value < 0) {
      throw new Error('Discount value must be a non-negative number');
    }

    if (type === 'percentage' && value > 100) {
      throw new Error('Percentage discount cannot exceed 100%');
    }
  }

  /**
   * Generate a human-readable description of the rule
   * @returns Description string
   */
  public getDescription(): string {
    const parts: string[] = [];

    parts.push(`${this.type} rule`);

    // Add conditions
    if (Object.keys(this.conditions).length > 0) {
      const conditionParts: string[] = [];
      for (const [key, condition] of Object.entries(this.conditions)) {
        if (typeof condition === 'object' && condition !== null && 'operator' in condition) {
          const opCondition = condition as OperatorCondition;
          conditionParts.push(`${key} ${this.getOperatorSymbol(opCondition.operator)} ${opCondition.value}`);
        } else if (Array.isArray(condition)) {
          conditionParts.push(`${key} in [${condition.join(', ')}]`);
        } else {
          conditionParts.push(`${key}=${condition}`);
        }
      }
      parts.push(`when ${conditionParts.join(' and ')}`);
    }

    // Add actions
    if (Object.keys(this.actions).length > 0) {
      const actionParts: string[] = [];
      for (const [actionKey, actionValue] of Object.entries(this.actions)) {
        if (actionKey === 'discount') {
          const discount = actionValue as DiscountAction;
          if (discount.type === 'percentage') {
            actionParts.push(`${discount.value}% discount`);
          } else {
            actionParts.push(`$${discount.value} discount`);
          }
        } else if (actionKey === 'addBonus') {
          const bonus = actionValue as any;
          actionParts.push(`add ${bonus.value} bonus`);
        }
      }
      parts.push(`then ${actionParts.join(' and ')}`);
    }

    return parts.join(' ');
  }

  /**
   * Get operator symbol for description
   * @param operator The operator
   * @returns Symbol representation
   */
  private getOperatorSymbol(operator: ConditionOperator): string {
    switch (operator) {
      case 'eq': return '==';
      case 'neq': return '!=';
      case 'gt': return '>';
      case 'gte': return '>=';
      case 'lt': return '<';
      case 'lte': return '<=';
      case 'in': return 'in';
      case 'nin': return 'not in';
      default: return operator;
    }
  }

  /**
   * Create a deep copy of the rule
   * @param newRuleId Optional new rule ID for the clone
   * @returns Cloned rule instance
   */
  public clone(newRuleId?: string): Rules {
    const clonedConditions = JSON.parse(JSON.stringify(this.conditions));
    const clonedActions = JSON.parse(JSON.stringify(this.actions));

    return new Rules(
      newRuleId || this.ruleId,
      this.type,
      clonedConditions,
      clonedActions
    );
  }
}