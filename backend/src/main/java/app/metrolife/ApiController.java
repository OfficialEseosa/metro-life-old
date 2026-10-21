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
    @GetMapping("/venue-moment") ObjectNode venueMoment(@CookieValue(name="ml_session",required=false)String token,@RequestParam String loc){synchronized(game){return game.landmarkLife.read(token,loc);}}
    @PostMapping("/venue-moment") ObjectNode venueMoment(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){synchronized(game){return game.landmarkLife.mutate(token,body);}}
    @GetMapping("/social-life") ObjectNode socialLife(@CookieValue(name="ml_session",required=false)String token,@RequestParam(defaultValue="")String city){synchronized(game){return game.socialLife.read(token,game.defaultCity(token,city));}}
    @PostMapping("/emote") ObjectNode emote(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){synchronized(game){return game.socialLife.emote(token,body);}}
    @PostMapping("/event/join") ObjectNode eventJoin(@CookieValue(name="ml_session",required=false)String token){synchronized(game){return game.socialLife.joinEvent(token);}}
    @PostMapping("/shift/timing") ObjectNode timing(@CookieValue(name="ml_session",required=false)String token){synchronized(game){return game.socialLife.timing(token);}}
    @PostMapping("/invite") ObjectNode invite(@CookieValue(name="ml_session",required=false)String token){synchronized(game){return game.socialLife.invite(token);}}
    @PostMapping("/invite/join") ObjectNode inviteJoin(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){synchronized(game){return game.socialLife.joinInvite(token,body);}}
    @PostMapping("/quick-start") ObjectNode quickStart(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){synchronized(game){return game.socialLife.quickStart(token,body);}}
    @PostMapping("/open-house") ObjectNode openHouse(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){synchronized(game){return game.socialLife.house(token,body);}}
    @PostMapping("/open-house/visit") ObjectNode visitHouse(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){synchronized(game){return game.socialLife.visit(token,body);}}
    @PostMapping("/open-house/like") ObjectNode likeHouse(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){synchronized(game){return game.socialLife.like(token,body);}}
    @GetMapping("/name") ObjectNode name(@CookieValue(name="ml_session",required=false)String token){return game.suggestName(token);}
    @GetMapping("/world") ObjectNode world(){return content.world;}
    @GetMapping("/version") Map<String,String> version(){return Map.of("build","metro-life-v2");}
    @GetMapping("/stats") ObjectNode stats(){return game.stats();}
    @GetMapping("/daily") ObjectNode daily(@CookieValue(name="ml_session",required=false)String token,@RequestParam(defaultValue="")String city){return game.daily(token,game.defaultCity(token,city));}
    @GetMapping("/auth/me") ObjectNode me(@CookieValue(name="ml_session",required=false)String token){return game.me(token);}
    @PostMapping("/auth/guest") ObjectNode guest(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body,HttpServletRequest req,HttpServletResponse res){var r=game.guest(token,body);cookie(req,res,r.token());ObjectNode out=game.object();out.set("user",r.user());return out;}
    @PostMapping("/life/new") ObjectNode newLife(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body,HttpServletRequest req,HttpServletResponse res){var r=game.newLife(token,body);cookie(req,res,r.token());ObjectNode out=game.object();out.set("user",r.user());return out;}
    @PostMapping("/first-day/complete") ObjectNode firstDay(@CookieValue(name="ml_session",required=false)String token){return game.finishFirstDay(token);}
    @PostMapping("/intro/complete") ObjectNode intro(@CookieValue(name="ml_session",required=false)String token){return game.finishIntro(token);}
    @PostMapping("/home/rent") ObjectNode rent(@CookieValue(name="ml_session",required=false)String token){return game.payFirstRent(token);}
    @PostMapping("/sim/outfit") ObjectNode outfit(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.outfit(token,body);}
    @GetMapping("/sim") ObjectNode sim(@CookieValue(name="ml_session",required=false)String token){return game.getSim(token);}
    @PostMapping("/sim/setup") ObjectNode setup(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.setup(token,body);}
    @PostMapping("/travel") ObjectNode travel(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.travel(token,body);}
    @PostMapping("/door") ObjectNode door(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.door(token,body);}
    @PostMapping("/posture") ObjectNode posture(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.posture(token,body);}
    @PostMapping("/move") ObjectNode walk(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.movePosition(token,body);}
    @PostMapping("/act") ObjectNode act(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.act(token,body);}
    @GetMapping("/transit") ObjectNode transit(@CookieValue(name="ml_session",required=false)String token,@RequestParam(defaultValue="")String city){return game.transit(token,game.defaultCity(token,city));}
    @PostMapping("/transit/book") ObjectNode bookTransit(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.bookTransit(token,body);}
    @PostMapping("/transit/nap") ObjectNode napTransit(@CookieValue(name="ml_session",required=false)String token){return game.napTransit(token);}
    @PostMapping("/transit/chat") ObjectNode chatTransit(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.chatTransit(token,body);}
    @PostMapping("/action/cancel") ObjectNode cancelAction(@CookieValue(name="ml_session",required=false)String token){return game.cancelAction(token);}
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
    @GetMapping("/home/design") ObjectNode design(@CookieValue(name="ml_session",required=false)String token){return game.homeDesign(token);}
    @PostMapping("/home/design") ObjectNode design(@CookieValue(name="ml_session",required=false)String token,@RequestBody JsonNode body){return game.homeDesign(token,body);}
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
