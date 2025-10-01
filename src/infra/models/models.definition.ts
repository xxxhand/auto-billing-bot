import type { WithId } from 'mongodb';
import { IExampleModel } from './example.model';
import { IProductModel } from './product.model';
import { IUserModel } from './user.model';

export enum modelNames {
  EXAMPLE = 'Examples',
  PRODUCTS = 'Products',
  USERS = 'Users',
}

export type IExampleDocument = WithId<IExampleModel>;
export type IProductDocument = WithId<IProductModel>;
export type IUserDocument = WithId<IUserModel>;
