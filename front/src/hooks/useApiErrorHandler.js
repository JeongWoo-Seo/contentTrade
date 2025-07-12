import { useState, useCallback } from 'react';
// import { useNavigate } from 'react-router-dom'; // React Router를 사용한다면 주석 해제

const useApiErrorHandler = () => {
  const [errorMessage, setErrorMessage] = useState(null);
  // const navigate = useNavigate(); // React Router를 사용한다면 주석 해제

  const handleError = useCallback((error, customErrorMessages = {}) => {
    let message = '알 수 없는 오류가 발생했습니다.'; // 기본 오류 메시지

    if (error.response) {
      // 서버가 응답을 했지만 2xx 범위를 벗어나는 경우 (HTTP 상태 코드 기반)
      const status = error.response.status;
      const data = error.response.data; // 서버에서 보낸 오류 상세 데이터

      switch (status) {
        case 400:
          message = customErrorMessages[400] || (data.message || '잘못된 요청입니다.');
          break;
        case 401:
          message = customErrorMessages[401] || (data.message || '인증이 필요합니다. 다시 로그인해주세요.');
          // 예: 로그인 페이지로 강제 리다이렉트
          // navigate('/login');
          break;
        case 403:
          message = customErrorMessages[403] || (data.message || '이 작업에 대한 권한이 없습니다.');
          break;
        case 404:
          message = customErrorMessages[404] || (data.message || '요청한 리소스를 찾을 수 없습니다.');
          break;
        case 500:
          message = customErrorMessages[500] || (data.message || '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
          break;
        default:
          message = customErrorMessages[status] || (data.message || `오류 발생: ${status}`);
          break;
      }
    } else if (error.request) {
      // 요청은 전송되었지만 응답을 받지 못한 경우 (네트워크 문제 등)
      message = customErrorMessages.network || '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.';
    } else {
      // 요청 설정 중 오류 발생
      message = customErrorMessages.general || error.message || '요청 설정 중 오류가 발생했습니다.';
    }

    setErrorMessage(message); // 오류 메시지 상태 업데이트
    console.error('API Error:', error); // 개발자 콘솔에 전체 오류 객체 로깅
  }, []); // useCallback의 의존성 배열이 비어있으므로 컴포넌트 마운트 시 한 번만 생성됩니다.

  const clearError = useCallback(() => {
    setErrorMessage(null); // 오류 메시지 초기화
  }, []);

  return { errorMessage, handleError, clearError };
};

export default useApiErrorHandler;