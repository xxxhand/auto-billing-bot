import { CustomValidator } from '@xxxhand/app-common';

export abstract class BaseEntity {
  public id: string = '';

  public isNew(): boolean {
    return !CustomValidator.nonEmptyString(this.id);
  }
}
