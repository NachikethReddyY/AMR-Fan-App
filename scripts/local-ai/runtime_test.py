import unittest
from types import SimpleNamespace
from runtime import validate_payload

class BoundaryTests(unittest.TestCase):
    def test_only_exact_questions_and_no_model_switch(self):
        from runtime import QUESTIONS
        self.assertEqual(validate_payload({'state':'Water use fell.', 'questions':{'category':QUESTIONS['category']}},'multilingual')['state'],'Water use fell.')
        for value in [None, {}, {'state':'x','questions':{}}, {'state':'x'*1601,'questions':{}}, {'state':'x','questions':{'approval':{'type':'choice'}}}, {'state':'x','questions':{'category':QUESTIONS['category']},'model':'english'}, {'state':'x','questions':{'category':QUESTIONS['category']},'secret':'x'}]:
            with self.assertRaises(ValueError): validate_payload(value,'multilingual')

class HttpTests(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        from runtime import create_app
        self.calls = 0
        def predict(state, questions):
            self.calls += 1
            return {'answers':{key:{'choice':'water'} for key in questions}}
        self.agent = SimpleNamespace(device='mps', cfg={'max_len':512,'head_max_len':192},
            tok=FakeTokenizer(), predict=predict)
        self.client = TestClient(create_app(self.agent,'multilingual',{'requests':0}))
    def tearDown(self): self.client.close()
    def test_live_http_shape_and_limits(self):
        from runtime import QUESTIONS
        payload={'state':'Water consumption.', 'questions':{'category':QUESTIONS['category']}}
        self.assertEqual(self.client.post('/v1/systemone',json=payload).status_code,200)
        self.assertEqual(self.calls,1)
        self.assertEqual(self.client.post('/v1/systemone',content='{').status_code,400)
        self.assertEqual(self.client.post('/v1/systemone',content='x'*8193).status_code,413)
        self.assertEqual(self.client.post('/v1/systemone',json=payload,headers={'Origin':'http://untrusted.test'}).status_code,403)
        self.assertEqual(self.client.post('/v1/systemone',json={**payload,'state':'x'*400}).status_code,413)
        self.assertEqual(self.client.post('/v1/systemone',json={**payload,'model':'typed-decisions'}).status_code,400)
        self.assertEqual(self.calls,1)
    def test_concurrent_inference_rejects_without_queue(self):
        import threading
        from runtime import QUESTIONS
        entered, release = threading.Event(), threading.Event()
        def slow(*_):
            entered.set(); release.wait(1)
            return {'answers':{'category':{'choice':'water'}}}
        self.agent.predict=slow
        payload={'state':'water','questions':{'category':QUESTIONS['category']}}
        result=[]
        thread=threading.Thread(target=lambda:result.append(self.client.post('/v1/systemone',json=payload).status_code))
        thread.start(); self.assertTrue(entered.wait(1))
        try:self.assertEqual(self.client.post('/v1/systemone',json=payload).status_code,503)
        finally:release.set();thread.join(2)
        self.assertEqual(result,[200])
    def test_failure_retains_health_and_no_raw_exception(self):
        from runtime import QUESTIONS
        def fail(*_): raise RuntimeError('private source text')
        self.agent.predict=fail
        r=self.client.post('/v1/systemone',json={'state':'water','questions':{'category':QUESTIONS['category']}})
        self.assertEqual(r.status_code,502)
        self.assertNotIn('private',r.text)
        self.assertEqual(self.client.get('/health').status_code,200)

class FakeTokenizer:
    mask_token='[MASK]'
    def __call__(self,text,**_): return {'input_ids':list(text)}

if __name__ == '__main__': unittest.main()
