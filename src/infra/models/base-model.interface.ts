export interface IBaseModel {
  /** create time */
  createdAt?: Date;
  /** update time */
  updatedAt?: Date;
  /** is valid flag for soft delete */
  valid: boolean;
}
