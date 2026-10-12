import { errorsFor } from '../../../../test/helpers/validate-dto';
import { CreateProductDto } from './create-product.dto';

const product = {
  name: 'Tea',
  code: 'TEA1',
  has_variants: false,
  variants: [{ name: 'Default', regular_price: 10 }],
};

describe('product tax rate', () => {
  it.each([0, 5, 15, 100])(
    '[BE-DTO-700] whole-number tax %s is accepted',
    async (tax) => {
      const errors = await errorsFor(CreateProductDto, { ...product, tax });
      expect(errors.filter((e) => e.startsWith('tax.'))).toEqual([]);
    },
  );
  it.each([7.5, 0.1, -1, 101])(
    '[BE-DTO-701] tax %s is rejected up front (Product.tax is an integer column)',
    async (tax) => {
      const errors = await errorsFor(CreateProductDto, { ...product, tax });
      expect(errors.some((e) => e.startsWith('tax.'))).toBe(true);
    },
  );
});
