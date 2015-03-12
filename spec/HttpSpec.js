describe('jasmine-http', function(){
  var request = require('request');

  it("should respond with hello world", function(done) {
    request("http://localhost:3005/api", function(err, res, body){
      expect(res.statusCode).toBe(200);
      var json = JSON.parse(body);
      expect(json.status).toBe('success');
      done();
    });
  });

});