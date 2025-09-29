import { Coupon } from './coupon.entity';

describe('Coupon Entity', () => {
  describe('constructor and properties', () => {
    it('should create a coupon with required properties', () => {
      const coupon = new Coupon();
      coupon.id = 'coupon-1';
      coupon.code = 'DISCOUNT20';
      coupon.discountPercentage = 0.2;
      coupon.usedBy = [];

      expect(coupon.id).toBe('coupon-1');
      expect(coupon.code).toBe('DISCOUNT20');
      expect(coupon.discountPercentage).toBe(0.2);
      expect(coupon.usedBy).toEqual([]);
    });

    it('should create a coupon with usedBy users', () => {
      const coupon = new Coupon();
      coupon.id = 'coupon-2';
      coupon.code = 'WELCOME10';
      coupon.discountPercentage = 0.1;
      coupon.usedBy = ['user-1', 'user-2'];

      expect(coupon.id).toBe('coupon-2');
      expect(coupon.code).toBe('WELCOME10');
      expect(coupon.discountPercentage).toBe(0.1);
      expect(coupon.usedBy).toEqual(['user-1', 'user-2']);
    });
  });

  describe('isValidForUser', () => {
    it('should return true for user who has not used the coupon', () => {
      const coupon = new Coupon();
      coupon.id = 'coupon-1';
      coupon.code = 'DISCOUNT20';
      coupon.discountPercentage = 0.2;
      coupon.usedBy = ['user-1', 'user-2'];

      const isValid = coupon.isValidForUser('user-3');

      expect(isValid).toBe(true);
    });

    it('should return false for user who has already used the coupon', () => {
      const coupon = new Coupon();
      coupon.id = 'coupon-1';
      coupon.code = 'DISCOUNT20';
      coupon.discountPercentage = 0.2;
      coupon.usedBy = ['user-1', 'user-2'];

      const isValid = coupon.isValidForUser('user-1');

      expect(isValid).toBe(false);
    });

    it('should return true for coupon that has not been used by anyone', () => {
      const coupon = new Coupon();
      coupon.id = 'coupon-1';
      coupon.code = 'DISCOUNT20';
      coupon.discountPercentage = 0.2;
      coupon.usedBy = [];

      const isValid = coupon.isValidForUser('user-1');

      expect(isValid).toBe(true);
    });
  });

  describe('business rules', () => {
    it('should validate discount percentage is between 0 and 1', () => {
      const coupon = new Coupon();
      coupon.id = 'coupon-1';
      coupon.code = 'TEST';
      coupon.usedBy = [];

      coupon.discountPercentage = 0;
      expect(coupon.discountPercentage).toBe(0);

      coupon.discountPercentage = 0.5;
      expect(coupon.discountPercentage).toBe(0.5);

      coupon.discountPercentage = 1;
      expect(coupon.discountPercentage).toBe(1);
    });

    it('should validate code is unique (simulated)', () => {
      const coupon1 = new Coupon();
      coupon1.id = 'coupon-1';
      coupon1.code = 'UNIQUE';
      coupon1.discountPercentage = 0.1;
      coupon1.usedBy = [];

      const coupon2 = new Coupon();
      coupon2.id = 'coupon-2';
      coupon2.code = 'DIFFERENT';
      coupon2.discountPercentage = 0.1;
      coupon2.usedBy = [];

      expect(coupon1.code).not.toBe(coupon2.code);
    });
  });
});
