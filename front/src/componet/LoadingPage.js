import Spinner from '../Infinity.gif'

export default function LoadingPage(){
    return (
        <div>
      <h4>잠시만 기다려 주세요.</h4>
      <img src={Spinner} alt='생성중' width='35%'/>
    </div>
    )
}