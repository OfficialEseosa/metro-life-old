package app.metrolife;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiController {
    final GameService game;final Content content;
    ApiController(GameService game,Content content){this.game=game;this.content=content;}
    void cookie(HttpServletRequest req,HttpServletResponse res,String token){res.addHeader("Set-Cookie",ResponseCookie.from("ml_session",token).httpOnly(true).secure(req.isSecure()).sameSite("Lax").path("/").maxAge(token.isEmpty()?0:30L*86400).build().toString());res.setHeader("Cache-Control","no-store");}
    @GetMapping("/world") ObjectNode world(){return content.world;}
    @GetMapping("/version") Map<String,String> version(){return Map.of("build","metro-life-m8");}
    @GetMapping("/stats") ObjectNode stats(){return game.stats();}
    @GetMapping("/daily") ObjectNode daily(@CookieValue(name="ml_session",required=false)String token,@RequestParam(defaultValue="")String city){return game.daily(token,game.defaultCity(token,city));}
    @GetMapping("/auth/me") ObjectNode me(@CookieValue(name="ml_session",required=false)String token){return game.me(token);}
    @PostMapping("/auth/{kind:guest|signup|login}") ObjectNode auth(@PathVariable String kind,@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body,HttpServletRequest req,HttpServletResponse res){GameService.AuthResult result=switch(kind){case "guest"->game.guest(token,body);case "signup"->game.signup(token,body,req.getRemoteAddr());default->game.login(token,body,req.getRemoteAddr());};cookie(req,res,result.token());ObjectNode out=game.object();out.set("user",result.user());return out;}
    @PostMapping("/auth/logout") ObjectNode logout(@CookieValue(name="ml_session",required=false)String token,HttpServletRequest req,HttpServletResponse res){cookie(req,res,"");return game.logout(token);}
    @GetMapping("/worlds") ObjectNode worlds(@CookieValue(name="ml_session",required=false)String token){return game.worlds(token);}
    @PostMapping("/worlds") ObjectNode create(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.createWorld(token,body);}
    @PostMapping("/worlds/join") ObjectNode join(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.joinWorld(token,body);}
    @PostMapping("/worlds/select") ObjectNode select(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.selectWorld(token,body);}
    @GetMapping("/sim") ObjectNode sim(@CookieValue(name="ml_session",required=false)String token){return game.getSim(token);}
    @PostMapping("/sim/setup") ObjectNode setup(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.setup(token,body);}
    @PostMapping("/travel") ObjectNode travel(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.travel(token,body);}
    @PostMapping("/door") ObjectNode door(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.door(token,body);}
    @PostMapping("/move") ObjectNode walk(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.movePosition(token,body);}
    @PostMapping("/act") ObjectNode act(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.act(token,body);}
    @PostMapping("/aspiration") ObjectNode aspiration(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.setAspiration(token,body);}
    @PostMapping("/story/choose") ObjectNode choose(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.chooseStory(token,body);}
    @GetMapping("/jobs") ObjectNode jobs(@CookieValue(name="ml_session",required=false)String token,@RequestParam(defaultValue="")String city){return game.jobs(token,game.defaultCity(token,city));}
    @PostMapping("/jobs/apply") ObjectNode apply(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.applyJob(token,body);}
    @PostMapping("/jobs/quit") ObjectNode quit(@CookieValue(name="ml_session",required=false)String token){return game.quitJob(token);}
    @GetMapping("/players") ObjectNode players(@CookieValue(name="ml_session",required=false)String token,@RequestParam(defaultValue="")String city){return game.players(token,game.defaultCity(token,city));}
    @GetMapping("/chat") ObjectNode chat(@CookieValue(name="ml_session",required=false)String token,@RequestParam(defaultValue="")String city){return game.chat(token,game.defaultCity(token,city));}
    @PostMapping("/chat") ObjectNode say(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.say(token,body);}
    @PostMapping("/social") ObjectNode social(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.social(token,body);}
    @GetMapping("/mayor") ObjectNode mayor(@CookieValue(name="ml_session",required=false)String token,@RequestParam(defaultValue="")String city){return game.mayor(token,game.defaultCity(token,city));}
    @PostMapping("/mayor/{kind:vote|run|policy|announce}") ObjectNode civic(@PathVariable String kind,@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.mayorAction(token,kind,body);}
    @GetMapping("/plots") ObjectNode plots(@CookieValue(name="ml_session",required=false)String token,@RequestParam(defaultValue="")String city){return game.plots(token,game.defaultCity(token,city));}
    @PostMapping("/plots") ObjectNode buyPlot(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.buyPlot(token,body);}
    @GetMapping("/billboards") ObjectNode boards(@CookieValue(name="ml_session",required=false)String token,@RequestParam(defaultValue="")String city){return game.billboards(token,game.defaultCity(token,city));}
    @PostMapping("/billboards") ObjectNode book(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.bookBillboard(token,body);}
    @GetMapping("/homes") ObjectNode homes(@CookieValue(name="ml_session",required=false)String token,@RequestParam(defaultValue="")String city){return game.homes(token,game.defaultCity(token,city));}
    @PostMapping("/home/move") ObjectNode move(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.moveHome(token,body);}
    @GetMapping(value="/plots/atlas.png",produces="image/png") ResponseEntity<byte[]> atlas(@CookieValue(name="ml_session",required=false)String token,@RequestParam(defaultValue="")String city,@RequestParam(defaultValue="")String world){return ResponseEntity.ok().header("Cache-Control","private, no-cache").body(game.atlas(token,game.defaultCity(token,city),world));}
    @GetMapping(value="/{kind:plots|billboards}/{id}/image",produces="image/png") ResponseEntity<byte[]> art(@PathVariable String kind,@PathVariable String id,@CookieValue(name="ml_session",required=false)String token){return ResponseEntity.ok().header("Cache-Control","private, max-age=60").body(game.art(token,kind,id));}

}

@RestControllerAdvice
class ErrorHandler {
    @ExceptionHandler(ApiException.class) ResponseEntity<?> api(ApiException e){return ResponseEntity.status(e.status).body(Map.of("error",e.getMessage()));}
    @ExceptionHandler(HttpMessageNotReadableException.class) ResponseEntity<?> malformed(){return ResponseEntity.badRequest().body(Map.of("error","Send a valid JSON request"));}
}
