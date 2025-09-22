import { BaseEntity } from './base-entity.abstract';

export class OperationLog extends BaseEntity {
  public subscriptionId: string = '';
  public action: string = '';
  public createdAt: string = '';

  constructor() {
    super();
  }
}
