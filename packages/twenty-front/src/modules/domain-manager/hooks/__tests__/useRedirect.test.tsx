import { renderHook } from '@testing-library/react';

import { useRedirect } from '@/domain-manager/hooks/useRedirect';

describe('useRedirect', () => {
  it('should navigate when the caller unmounts before the debounce fires', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const { result, unmount } = renderHook(() => useRedirect());

    result.current.redirect('https://app.arxena.com/welcome');
    unmount();

    expect(openSpy).toHaveBeenCalledWith(
      'https://app.arxena.com/welcome',
      '_self',
    );

    openSpy.mockRestore();
  });
});
