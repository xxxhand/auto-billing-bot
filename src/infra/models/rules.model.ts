import { IBaseModel } from './base-model.interface';

export interface IRulesModel extends IBaseModel {
  /** Rule unique identifier (PK) */
  ruleId: string;
  /** Rule type (e.g., "billing", "discount") */
  type: string;
  /** Condition logic */
  conditions: Record<string, any>;
  /** Action logic */
  actions: Record<string, any>;
}
