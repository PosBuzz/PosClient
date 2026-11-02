import { amountInWords } from './amount-in-words';

describe('amountInWords', () => {
  it.each([
    [0, 'Zero Taka Only'],
    [1, 'One Taka Only'],
    [19, 'Nineteen Taka Only'],
    [45, 'Forty Five Taka Only'],
    [100, 'One Hundred Taka Only'],
    [1250, 'One Thousand Two Hundred Fifty Taka Only'],
    [100000, 'One Lakh Taka Only'],
    [
      1234567,
      'Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Taka Only',
    ],
    [10000000, 'One Crore Taka Only'],
    [250.5, 'Two Hundred Fifty Taka and Fifty Paisa Only'],
    [0.07, 'Zero Taka and Seven Paisa Only'],
    [-12, 'Minus Twelve Taka Only'],
  ])('[BE-RCP-050] %p -> %s', (amount, words) => {
    expect(amountInWords(amount)).toBe(words);
  });

  it('[BE-RCP-051] rounds to whole paisa and carries into taka', () => {
    expect(amountInWords(9.999)).toBe('Ten Taka Only');
  });
});
