import Spinner from '../Infinity.gif';

export default function LoadingPage() {
    return (
        <div style={styles.container}>
            <h4 style={styles.text}>잠시만 기다려 주세요.</h4>
            <img src={Spinner} alt="로딩 중" style={styles.image} />
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh', // 전체 화면 중앙 정렬
        backgroundColor: '#f9f9f9', // 선택적 배경색
    },
    text: {
        marginBottom: '1rem',
        color: '#333',
        fontSize: '1.2rem',
    },
    image: {
        width: '35%',
        maxWidth: '200px',
    },
};
