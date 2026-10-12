package app.metrolife;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.stereotype.Service;
import java.security.SecureRandom;
import java.util.*;
import java.util.function.LongSupplier;

/** A single monitor is the transaction boundary for the small local simulation. */
@Service
public class GameService {
    final JsonStore store;
    final Content content;
    final ObjectMapper mapper;
    final Progression progression;
    final Stories stories;
    final Civic civic;final Property property;final Community community;
    LongSupplier time = System::currentTimeMillis;
    long visits;
    private final SecureRandom random = new SecureRandom();
    private final AuthAttempts authAttempts=new AuthAttempts();
    java.util.function.Function<String,String> hashPassword=Passwords::hash;
    java.util.function.BiPredicate<String,String> verifyPassword=Passwords::verify;
    GameService(JsonStore store, Content content, ObjectMapper mapper) { this.store=store;this.visits=store.data.path("visits").asLong();this.content=content;this.mapper=mapper;this.progression=new Progression(content);this.stories=new Stories(this);this.civic=new Civic(this);this.property=new Property(this);this.community=new Community(this);navigation=new Navigation(this); }
    long now() { return time.getAsLong(); }
    ObjectNode object() { return mapper.createObjectNode(); }
    ObjectNode table(String name) { return (ObjectNode)store.data.get(name); }
    String id() { return UUID.randomUUID().toString(); }
    static void require(boolean valid,int status,String message) { if(!valid) throw new ApiException(status,message); }
    ObjectNode session(String token,boolean required) {
        JsonNode s=token==null?null:table("sessions").get(token);
        if(s!=null && s.path("expiresAt").asLong()>now()) return (ObjectNode)s;
        if(required) throw new ApiException(401,"Please log in");return null;
    }
    ObjectNode user(ObjectNode session) { return (ObjectNode)table("users").get(session.path("userId").asText()); }
    ObjectNode publicUser(ObjectNode user) { ObjectNode copy=user.deepCopy();copy.remove(List.of("passwordHash","lastWorld"));return copy; }
    ObjectNode world(ObjectNode session) {return (ObjectNode)table("worlds").get(session==null?"public":session.path("worldId").asText("public"));}
    String simKey(ObjectNode session) {return session.path("userId").asText()+":"+world(session).path("id").asText();}
    ObjectNode sim(ObjectNode session) {ObjectNode s=(ObjectNode)table("sims").get(simKey(session));require(s!=null,409,"Choose your city and make yourself at home first");return s;}
    ObjectNode look(JsonNode custom) {
        ObjectNode look=object().put("body","f").put("skin","#b47752").put("hair","short").put("hairColor","#302820").put("top","#326957").put("bottom","#313c4b").put("style","casual").put("shoeColor","#f4eddf");
        if(custom!=null && custom.isObject()) {
            for(String field:new String[]{"skin","hairColor","top","bottom","shoeColor"}) if(custom.path(field).asText().matches("#[0-9a-fA-F]{6}")) look.put(field,custom.path(field).asText());
            if(Set.of("f","m").contains(custom.path("body").asText())) look.put("body",custom.path("body").asText());
            if(Set.of("short","long","curly","bald").contains(custom.path("hair").asText())) look.put("hair",custom.path("hair").asText());
            if(Set.of("casual","smart","street","work","party").contains(custom.path("style").asText())) look.put("style",custom.path("style").asText());
        }
        return look;
    }
    private String username(String name) {require(name.matches("[A-Za-z0-9][A-Za-z0-9 _-]{2,23}"),400,"Use 3–24 letters, numbers, spaces, underscores or hyphens");return name.trim();}
    private void unique(String name,String except) {for(JsonNode u:table("users")) require(u.path("id").asText().equals(except)||!u.path("username").asText().equalsIgnoreCase(name),409,"That name is already taken");for(JsonNode rows:community.residents())for(JsonNode n:rows)require(!n.path("username").asText().equalsIgnoreCase(name),409,"That name belongs to a city resident. Choose another name.");}
    private String issueSession(String old,ObjectNode u,String selected) {
        if(old!=null) table("sessions").remove(old);
        byte[] bytes=new byte[32];random.nextBytes(bytes);String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        table("sessions").putObject(token).put("userId",u.path("id").asText()).put("worldId",selected).put("expiresAt",now()+30L*86400000);
        return token;
    }
    public record AuthResult(String token,ObjectNode user) {}
    synchronized AuthResult guest(String token,JsonNode body) {
        ObjectNode old=session(token,false);
        if(old!=null) return new AuthResult(token,publicUser(user(old)));
        String name=body.path("username").asText("").trim(); if(name.isEmpty()) name=friendlyName();
        name=username(name);unique(name,"");String uid=id();
        ObjectNode u=table("users").putObject(uid).put("id",uid).put("username",name).put("guest",true).put("createdAt",now());u.set("look",look(body.get("look")));
        String issued=issueSession(null,u,"public");store.save();return new AuthResult(issued,publicUser(u));
    }
    AuthResult signup(String token,JsonNode body) {return signup(token,body,"local");}
    AuthResult signup(String token,JsonNode body,String ip) {
        String name=username(body.path("username").asText().trim()),password=body.path("password").asText();
        require(password.length()>=8 && password.length()<=128,400,"Use a password between 8 and 128 characters");
        authAttempts.check(ip,name,now());
        String expectedUid;
        synchronized(this){ObjectNode existing=session(token,false);if(existing!=null)require(user(existing).path("guest").asBoolean(),409,"You already have an account");expectedUid=existing==null?null:user(existing).path("id").asText();unique(name,expectedUid==null?"":expectedUid);}
        String hash;authAttempts.acquire();try{hash=hashPassword.apply(password);}finally{authAttempts.release();}
        synchronized(this){
        ObjectNode old=session(token,false);if(old!=null) require(user(old).path("guest").asBoolean(),409,"You already have an account");
        require(expectedUid==null?old==null:old!=null&&expectedUid.equals(user(old).path("id").asText()),409,"Your session changed. Try signing in again.");
        String uid=old==null?id():user(old).path("id").asText();unique(name,uid);
        ObjectNode u=old==null?table("users").putObject(uid).put("id",uid).put("createdAt",now()):user(old);
        u.put("username",name).put("guest",false).put("passwordHash",hash);
        if(!u.has("look")||body.has("look")) u.set("look",look(body.get("look")));
        for(JsonNode s:table("sims")) if(s.path("userId").asText().equals(uid)) {((ObjectNode)s).put("username",name).set("look",u.get("look").deepCopy());}
        String issued=issueSession(token,u,old==null?"public":old.path("worldId").asText());store.save();return new AuthResult(issued,publicUser(u));
        }
    }
    AuthResult login(String token,JsonNode body) {return login(token,body,"local");}
    AuthResult login(String token,JsonNode body,String ip) {
        String name=body.path("username").asText();String password=body.path("password").asText();require(password.length()<=128,400,"Password is too long");
        authAttempts.check(ip,name,now());
        String uid=null,hash="";
        synchronized(this){for(JsonNode u:table("users"))if(u.path("username").asText().equalsIgnoreCase(name.trim())){uid=u.path("id").asText();hash=u.path("passwordHash").asText();break;}}
        boolean valid;authAttempts.acquire();try{valid=verifyPassword.test(password,hash);}finally{authAttempts.release();}
        synchronized(this){
            ObjectNode u=uid==null?null:(ObjectNode)table("users").get(uid);
            require(valid&&u!=null&&hash.equals(u.path("passwordHash").asText()),401,"Name or password did not match");
            String selected=u.path("lastWorld").asText("public");String issued=issueSession(token,u,selected);store.save();return new AuthResult(issued,publicUser(u));
        }
    }
    synchronized ObjectNode logout(String token) {if(token!=null) table("sessions").remove(token);store.save();return object().put("ok",true);}
    ObjectNode clock(ObjectNode world) {
        long minutes=Math.max(0,(now()-world.path("startedAt").asLong())/1000)+9*60;
        int day=(int)(minutes/1440)+1;return object().put("day",day).put("hour",minutes%1440/60).put("minute",minutes%60).put("weekday",new String[]{"Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"}[(day-1)%7]).put("msPerMinute",1000).put("at",now());
    }
    ObjectNode worldInfo(ObjectNode w) {
        ObjectNode result=w.deepCopy();result.remove(List.of("members","startedAt"));int count=0;
        for(JsonNode s:table("sims")) if(s.path("worldId").equals(w.get("id"))) count++;
        return result.put("players",count+community.residents().path(w.path("id").asText()).size()).put("online",community.onlineCount(w.path("id").asText()));
    }
    synchronized ObjectNode me(String token) {
        ObjectNode session=session(token,false),w=world(session),out=object().put("now",now());out.set("clock",clock(w));
        if(session==null) {out.putNull("user").putNull("world").putNull("sim");return out;}
        out.set("user",publicUser(user(session)));out.set("world",worldInfo(w));ObjectNode s=(ObjectNode)table("sims").get(simKey(session));
        if(s!=null) {decay(s,w);out.set("sim",publicSim(s));} else out.putNull("sim");return out;
    }
    boolean belongs(ObjectNode w,String uid) {if(w.path("mode").asText().equals("public")) return true;for(JsonNode member:w.path("members")) if(member.asText().equals(uid)) return true;return false;}
    synchronized ObjectNode worlds(String token) {
        ObjectNode session=session(token,true),out=object();ArrayNode worlds=out.putArray("worlds");String uid=user(session).path("id").asText();
        for(JsonNode w:table("worlds")) if(belongs((ObjectNode)w,uid)) worlds.add(worldInfo((ObjectNode)w));return out.put("current",session.path("worldId").asText());
    }
    private void select(ObjectNode session,ObjectNode w) {session.put("worldId",w.path("id").asText());user(session).put("lastWorld",w.path("id").asText());}
    synchronized ObjectNode createWorld(String token,JsonNode body) {
        ObjectNode session=session(token,true);String mode=body.path("mode").asText();require(Set.of("solo","private").contains(mode),400,"Choose solo or private");
        String name=body.path("name").asText("").strip();require(name.length()>=1&&name.length()<=40&&!containsEmoji(name),400,"Give your world a name of 1–40 characters");
        String wid=id(),uid=session.path("userId").asText();ObjectNode w=table("worlds").putObject(wid).put("id",wid).put("name",name).put("mode",mode).put("ownerId",uid).put("startedAt",now());
        if(mode.equals("private")) {String code;do {code=id().replace("-","").substring(0,8).toUpperCase(Locale.ROOT);} while(codeExists(code));w.put("code",code);} else w.putNull("code");
        w.putArray("members").add(uid);select(session,w);store.save();ObjectNode out=object();out.set("world",worldInfo(w));return out;
    }
    boolean codeExists(String code) {for(JsonNode w:table("worlds")) if(w.path("code").asText().equals(code)) return true;return false;}
    synchronized ObjectNode joinWorld(String token,JsonNode body) {
        ObjectNode session=session(token,true);String code=body.path("code").asText().strip().toUpperCase(Locale.ROOT);require(code.matches("[A-F0-9]{8}"),404,"That private world code was not found");
        for(JsonNode node:table("worlds")) {
            ObjectNode w=(ObjectNode)node;
            if(w.path("mode").asText().equals("private")&&w.path("code").asText().equals(code)) {
                if(!belongs(w,session.path("userId").asText())) w.withArray("members").add(session.path("userId").asText());
                select(session,w);store.save();ObjectNode out=object();out.set("world",worldInfo(w));return out;
            }
        }
        throw new ApiException(404,"That private world code was not found");
    }
    Navigation navigation;
    synchronized ObjectNode selectWorld(String token,JsonNode body) {
        ObjectNode session=session(token,true),w=(ObjectNode)table("worlds").get(body.path("worldId").asText());
        require(w!=null&&belongs(w,session.path("userId").asText()),403,"Join this world with its private code first");select(session,w);store.save();
        ObjectNode out=object();out.set("world",worldInfo(w));ObjectNode s=(ObjectNode)table("sims").get(simKey(session));if(s==null)out.putNull("sim");else {decay(s,w);out.set("sim",publicSim(s));store.save();}return out;
    }
    ObjectNode publicSim(ObjectNode s) {navigation.position(s);ObjectNode copy=s.deepCopy();copy.put("createdAt",createdAt(s));if(copy.path("aspiration").isObject())copy.withObject("aspiration").set("milestones",progression.milestones(s));copy.set("stories",stories.journal(s));copy.remove(List.of("updatedAt","lastDay","actionsCount","_pendingAction","_metrics","_stories","_claims","_readyClaims","_storyDeparted","_externalMetrics","_externalProgress","_lastChat","_lastSocial","_socialText","_socialAt","_socialFrom","dailyVisited"));for(String need:Content.NEEDS)copy.withObject("needs").put(need,Math.round(s.path("needs").path(need).asDouble()*10)/10.0);return copy;}
    String friendlyName(){
        String[] first={"Avery","Riley","Jordan","Casey","Morgan","Taylor","Alex","Jamie","Quinn","Rowan","Sage","Skyler","Reese","Parker","Cameron","Blair"};
        String[] last={"Brooks","Vale","Reed","Lane","Park","Ellis","Hayes","Quill","Blake","Bell","Stone","Wells","Banks","Hill","West","Hart"};
        for(int attempt=0;;attempt++){String name=first[random.nextInt(first.length)]+" "+last[random.nextInt(last.length)]+(attempt>50?" "+random.nextInt(1000):"");boolean used=false;for(JsonNode u:table("users"))if(u.path("username").asText().equalsIgnoreCase(name))used=true;for(JsonNode rows:community.residents())for(JsonNode n:rows)if(n.path("username").asText().equalsIgnoreCase(name))used=true;if(!used)return name;}
    }
    synchronized ObjectNode setup(String token,JsonNode body) {
        ObjectNode session=session(token,true),u=user(session);String city=body.path("city").asText(),nh=body.path("neighborhood").asText(),aid=body.path("aspiration").asText();
        content.city(city);ObjectNode neighborhood=content.neighborhood(city,nh),aspiration=content.aspiration(aid);
        ObjectNode existing=(ObjectNode)table("sims").get(simKey(session));
        // Onboarding is one-time. Repeating it must never mint money or teleport a resident.
        if(existing!=null) throw new ApiException(409,"Your life is already set up. Use your home or aspiration panel to make changes");
        if(body.has("look")) u.set("look",look(body.get("look")));
        ObjectNode s=table("sims").putObject(simKey(session)).put("userId",u.path("id").asText()).put("worldId",world(session).path("id").asText()).put("username",u.path("username").asText()).put("city",city).put("loc","home").put("cash",content.world.path("startingCash").asDouble()).put("xp",0).put("level",1).put("xpNext",100).put("mood","great").put("setupDone",true).put("createdAt",now()).put("updatedAt",now()).put("lastDay",clock(world(session)).path("day").asInt()).put("actionsCount",0);
        s.set("look",u.get("look").deepCopy());s.putObject("home").put("city",city).put("neighborhood",nh).put("rent",neighborhood.path("rent").asInt());
        ObjectNode needs=s.putObject("needs");for(String need:Content.NEEDS) needs.put(need,85);
        ObjectNode skills=s.putObject("skills");for(String skill:Content.SKILLS) skills.putObject(skill).put("level",0).put("xp",0).put("next",100);
        s.putNull("job").putNull("busyUntil").putNull("busyLabel").putNull("pendingBeat");s.putArray("visited").add("home");
        ObjectNode a=s.putObject("aspiration").put("id",aid).put("label",aspiration.path("label").asText()).put("step",0).put("total",aspiration.path("milestones").size());a.set("current",aspiration.path("milestones").get(0).deepCopy());
        resetDaily(s);store.save();return simResponse(s,world(session));
    }
    void resetDaily(ObjectNode s) {
        s.putArray("dailyVisited");s.putObject("moneyToday").put("income",0).put("spent",0);
        ArrayNode goals=s.putArray("daily");String[] ids={"explore","work","cook"},texts={"Visit three places","Earn money from an activity","Cook a meal at home"},icons={"map-pin","briefcase","cooking-pot"};
        for(int i=0;i<3;i++){ObjectNode g=goals.addObject().put("id",ids[i]).put("text",texts[i]).put("icon",icons[i]).put("progress",0).put("target",i==0?3:1).put("done",false);g.putObject("reward").put("cash",45).put("xp",25);}
    }
    ObjectNode simResponse(ObjectNode s,ObjectNode w) {ObjectNode out=object();out.set("sim",publicSim(s));out.set("clock",clock(w));return out;}
    synchronized ObjectNode movePosition(String token,JsonNode body){return navigation.move(token,body);}
    synchronized ObjectNode getSim(String token) {ObjectNode session=session(token,true),s=sim(session),w=world(session);decay(s,w);return simResponse(s,w);}
    void decay(ObjectNode s,ObjectNode w) {
        civic.tick(w);property.syncPlots(s,w);int day=clock(w).path("day").asInt(),elapsed=Math.max(0,day-s.path("lastDay").asInt());if(elapsed>0){resetDaily(s);property.rent(s,w,elapsed);s.put("lastDay",day);}
        double hours=Math.min(6,Math.max(0,now()-s.path("updatedAt").asLong())/60000.0);
        if(s.has("_pendingAction")&&s.path("busyUntil").asLong()>0&&s.path("busyUntil").asLong()<=now()){
            double before=Math.min(hours,Math.max(0,s.path("busyUntil").asLong()-s.path("updatedAt").asLong())/60000.0);
            decayNeeds(s,before);settleAction(s);decayNeeds(s,hours-before);
        }else decayNeeds(s,hours);
        s.put("updatedAt",now());if(!s.path("busyUntil").isNull()&&s.path("busyUntil").asLong()<=now())s.putNull("busyUntil").putNull("busyLabel").putNull("busyStartedAt");
        if(s.path("_externalProgress").asBoolean()&&!s.has("_pendingAction"))finishProgress(s);property.rent(s,w,0);updateMood(s);
    }
    void finishProgress(ObjectNode s){s.remove("_externalProgress");double before=s.path("cash").asDouble();progression.evaluate(s,mapper.createArrayNode());double gain=s.path("cash").asDouble()-before;if(gain>0){ObjectNode ledger=s.withObject("moneyToday");ledger.put("income",ledger.path("income").asDouble()+gain);}updateLevel(s);}
    void decayNeeds(ObjectNode s,double hours){ObjectNode needs=s.withObject("needs");int[] rates={3,4,3,2};for(int i=0;i<Content.NEEDS.length;i++){String key=Content.NEEDS[i];needs.put(key,Math.max(0,needs.path(key).asDouble()-rates[i]*hours));}}
    void settleAction(ObjectNode s){
        JsonNode pending=s.remove("_pendingAction"),future=pending.path("state"),deltas=pending.path("deltas");
        s.put("cash",s.path("cash").asDouble()+deltas.path("cash").asDouble()).put("xp",s.path("xp").asInt()+deltas.path("xp").asInt());
        double cost=pending.path("cost").asDouble();ObjectNode money=s.withObject("moneyToday");money.put("spent",money.path("spent").asDouble()+cost).put("income",money.path("income").asDouble()+deltas.path("cash").asDouble()+cost);
        for(String field:List.of("city","loc","skills","job","visited","actionsCount","pendingBeat","aspiration","_metrics","_stories","_claims","_readyClaims","_storyDeparted"))if(future.has(field))s.set(field,future.path(field).deepCopy());
        if(future.path("lastDay").asInt()==s.path("lastDay").asInt()){s.set("daily",future.path("daily").deepCopy());if(future.has("dailyVisited"))s.set("dailyVisited",future.path("dailyVisited").deepCopy());}
        deltas.path("needs").fields().forEachRemaining(e->s.withObject("needs").put(e.getKey(),Math.clamp(s.path("needs").path(e.getKey()).asDouble()+e.getValue().asDouble(),0,100)));
        if(pending.has("campaignCity")){ObjectNode w=(ObjectNode)table("worlds").get(s.path("worldId").asText());civic.campaign(w,s,pending.path("campaignCity").asText(),pending.path("campaignTerm").asInt(),pending.path("campaignDay").asInt(s.path("lastDay").asInt()));}
        updateLevel(s);
    }
    void updateMood(ObjectNode s) {double min=100,sum=0;for(String n:Content.NEEDS){double v=s.path("needs").path(n).asDouble();min=Math.min(min,v);sum+=v;}s.put("mood",min<=5?"rough":min<20?"low":sum/4<45?"okay":sum/4<75?"good":"great");}
    void requirements(ObjectNode s,JsonNode requires) {
        require(s.path("cash").asDouble()>=requires.path("cash").asDouble(),402,"You need more cash for this");
        require(s.path("level").asInt()>=requires.path("level").asInt(),403,"Build your level before trying this");
        requires.path("skills").fields().forEachRemaining(e->require(s.path("skills").path(e.getKey()).path("level").asInt()>=e.getValue().asInt(),403,"You need "+Content.title(e.getKey())+" "+e.getValue().asInt()));
        if(requires.has("job")) require(s.path("job").path("track").asText().equals(requires.path("job").asText()),403,"Apply for this job before working a shift");
    }
    synchronized ObjectNode jobs(String token,String city){content.city(city);ObjectNode out=object();ArrayNode jobs=out.putArray("jobs");for(JsonNode career:content.world.path("careers"))for(JsonNode level:career.path("levels")){String track=career.path("track").asText();ObjectNode job=((ObjectNode)level).deepCopy();job.put("id",(city.equals("atl")?"":city+"-")+track+"-"+level.path("level").asInt()).put("track",track).put("city",city).put("loc",Content.workplace(city,track));job.remove("shiftsToPromote");jobs.add(job);}return out;}
    synchronized ObjectNode applyJob(String token,JsonNode body){
        ObjectNode session=session(token,true),s=sim(session);decay(s,world(session));require(s.path("busyUntil").isNull()&&s.path("pendingBeat").isNull(),409,"Finish your activity or story before applying");
        String jobId=body.path("jobId").asText();ObjectNode chosen=null;JsonNode careerChosen=null;
        for(JsonNode candidate:jobs(token,s.path("city").asText()).path("jobs"))if(candidate.path("id").asText().equals(jobId)){chosen=((ObjectNode)candidate).deepCopy();careerChosen=candidate;chosen.put("shiftsToPromote",3+candidate.path("level").asInt());}
        require(chosen!=null,404,"That job is no longer listed");require(s.path("city").equals(chosen.get("city")),403,"Travel to this city before applying");require(chosen.path("level").asInt()==1,403,"Apply for an entry role and earn promotions through shifts");require(s.path("loc").equals(chosen.path("loc")),409,"Visit the workplace before applying");require(civic.open(world(session),s.path("city").asText(),content.landmark(s.path("city").asText(),chosen.path("loc").asText()),clock(world(session)).path("hour").asInt()),409,"Apply while the workplace is open");requirements(s,chosen.path("requires"));
        require(chosen.path("level").asInt()==1,403,"Apply for an entry role and earn promotions through shifts");
        require(s.path("job").isNull(),409,"Leave your current role before accepting another");
        chosen.put("id",jobId).put("track",careerChosen.path("track").asText()).put("shifts",0);s.set("job",chosen);store.save();ObjectNode out=object().put("hired",true);out.set("sim",publicSim(s));return out;
    }
    synchronized ObjectNode quitJob(String token){ObjectNode session=session(token,true),s=sim(session);decay(s,world(session));require(s.path("busyUntil").isNull(),409,"Finish your shift before leaving your role");s.putNull("job");store.save();ObjectNode out=object();out.set("sim",publicSim(s));return out;}
    synchronized ObjectNode act(String token,JsonNode body) {
        ObjectNode session=session(token,true),live=sim(session),w=world(session);decay(live,w);ObjectNode s=live.deepCopy();
        String city=body.path("city").asText(),loc=body.path("loc").asText(),action=body.path("action").asText();content.city(city);
        require(s.path("city").asText().equals(city),403,"Fly to this city before doing an activity here");
        require(s.path("busyUntil").isNull(),409,"Finish your current activity first");
        require(s.path("pendingBeat").isNull(),409,"Choose what happens in your story first");
        JsonNode actions;
        if(loc.equals("home")){require(s.path("home").path("city").asText().equals(city),403,"Your home is in another city");actions=content.city(city).path("homeActions");}
        else {
            ObjectNode landmark=content.landmark(city,loc);int hour=clock(w).path("hour").asInt(),open=landmark.path("open").get(0).asInt(),close=landmark.path("open").get(1).asInt();
            require(civic.open(w,city,landmark,hour),409,"This place is closed. Try home or an open place");actions=landmark.path("actions");
        }
        ObjectNode a=null;for(JsonNode option:actions)if(option.path("id").asText().equals(action))a=(ObjectNode)option;
        require(a!=null,400,"Choose an activity offered at this place");requirements(s,a.path("requires"));
        if(a.path("kind").asText().equals("work"))for(String need:Content.NEEDS)require(s.path("needs").path(need).asDouble()>0,409,"Take care of your needs before working");
        if(a.path("requires").has("job"))require(s.path("job").path("city").asText().equals(city)&&s.path("job").path("loc").asText().equals(loc),403,"Work at your own workplace");
        double cashBefore=s.path("cash").asDouble();int xpBefore=s.path("xp").asInt();
        if(a.path("requires").has("job")){a=a.deepCopy();a.put("pay",s.path("job").path("payPerHour").asInt());s.withObject("job").put("shifts",s.path("job").path("shifts").asInt()+1);}
        a=civic.action(w,city,loc.equals("home")?object():content.landmark(city,loc),a);
        require(s.path("cash").asDouble()>=a.path("cost").asDouble(),402,"You do not have enough cash for this activity");
        boolean campaign=a.path("label").asText().equals("Campaign");if(campaign)civic.campaignCheck(w,s,city);
        boolean low=Set.of("rough","low").contains(s.path("mood").asText());double cashDelta=Math.floor(a.path("pay").asDouble()*(low?.7:1))-a.path("cost").asDouble();
        s.put("cash",s.path("cash").asDouble()+cashDelta);int xp=a.path("xp").asInt();s.put("xp",s.path("xp").asInt()+xp);int oldLevel=s.path("level").asInt();updateLevel(s);
        ObjectNode needDeltas=object(),skillDeltas=object();
        a.path("needs").fields().forEachRemaining(e->{ObjectNode needs=(ObjectNode)s.get("needs");double before=needs.path(e.getKey()).asDouble(),after=Math.clamp(before+e.getValue().asDouble(),0,100);needs.put(e.getKey(),after);needDeltas.put(e.getKey(),after-before);});
        a.path("skills").fields().forEachRemaining(e->{ObjectNode skill=(ObjectNode)s.path("skills").get(e.getKey());int gain=(int)Math.floor(e.getValue().asInt()*(low?.7:1));addSkill(skill,gain);skillDeltas.put(e.getKey(),gain);});
        boolean firstVisit=true;for(JsonNode visited:s.path("visited"))if(visited.asText().equals(loc))firstVisit=false;
        boolean dailyVisit=true;for(JsonNode visited:s.path("dailyVisited"))if(visited.asText().equals(city+":"+loc))dailyVisit=false;if(dailyVisit)s.withArray("dailyVisited").add(city+":"+loc);
        if(firstVisit)s.withArray("visited").add(loc);s.put("loc",loc).put("actionsCount",s.path("actionsCount").asInt()+1);
        if(a.has("to")){String to=a.path("to").asText();content.city(to);s.put("city",to).put("loc",to.equals("atl")?"atlAirport":to.equals("nyc")?"nycAirport":"bayAirport");}
        long busyUntil=now()+Math.clamp(a.path("durationMin").asLong()*60,2000,6000);s.put("busyUntil",busyUntil).put("busyLabel",a.path("label").asText());
        ArrayNode completed=mapper.createArrayNode();
        for(JsonNode node:s.path("daily")){ObjectNode g=(ObjectNode)node;if(g.path("done").asBoolean())continue;String gid=g.path("id").asText();boolean progress=gid.equals("explore")&&dailyVisit||gid.equals("work")&&a.path("pay").asInt()>0||gid.equals("cook")&&loc.equals("home")&&action.equals("cook");if(progress){int p=g.path("progress").asInt()+1;g.put("progress",p);if(p>=g.path("target").asInt()){g.put("done",true);s.put("cash",s.path("cash").asDouble()+g.path("reward").path("cash").asDouble());s.put("xp",s.path("xp").asInt()+g.path("reward").path("xp").asInt());completed.add(g.path("text").asText());}}}
        int dailyCount=completed.size();String promoted=progression.activity(s,a,loc);stories.depart(s,city,loc);if(!a.path("requires").has("job")&&!action.equals("visit-workplace"))stories.trigger(s,city,loc);progression.evaluate(s,completed);
        updateMood(s);updateLevel(s);
        ObjectNode out=object(),result=object().put("text",outcomeText(a,loc,action,cashDelta,needDeltas,skillDeltas,dailyCount)).put("busyUntil",busyUntil).put("leveledUp",s.path("level").asInt()>oldLevel).putNull("promoted").putNull("beat");
        if(completed.size()>dailyCount){StringBuilder text=new StringBuilder(result.path("text").asText());for(int i=dailyCount;i<completed.size();i++)text.append(" ").append(completed.get(i).asText()).append(" completed.");result.put("text",text.toString());}
        if(promoted!=null){result.put("promoted",promoted);result.put("text",result.path("text").asText()+" Promoted to "+promoted+"!");}result.set("beat",s.path("pendingBeat").deepCopy());
        ObjectNode deltas=result.putObject("deltas").put("cash",s.path("cash").asDouble()-cashBefore).put("xp",s.path("xp").asInt()-xpBefore);deltas.set("needs",needDeltas);deltas.set("skills",skillDeltas);result.set("goalsCompleted",completed);
        // Persist the accepted outcome; readers settle it exactly once at its deadline,
        // including after a restart. Clients cannot mint or accelerate the reward.
        ObjectNode pending=live.putObject("_pendingAction").put("cost",a.path("cost").asDouble());pending.set("state",s);pending.set("deltas",deltas.deepCopy());if(campaign)pending.put("campaignCity",city).put("campaignTerm",civic.state(w,city).path("term").asInt()).put("campaignDay",civic.day(w));
        live.put("loc",loc).put("busyStartedAt",now()).put("busyUntil",busyUntil).put("busyLabel",a.path("label").asText());store.save();
        out.set("sim",publicSim(live));out.set("result",result);return out;
    }
    synchronized ObjectNode setAspiration(String token,JsonNode body){
        ObjectNode session=session(token,true),s=sim(session);decay(s,world(session));require(s.path("busyUntil").isNull()&&s.path("pendingBeat").isNull(),409,"Finish your activity or story before changing dreams");
        progression.select(s,body.path("aspiration").asText());store.save();ObjectNode out=object();out.set("sim",publicSim(s));return out;
    }
    synchronized ObjectNode chooseStory(String token,JsonNode body){
        ObjectNode session=session(token,true),s=sim(session);decay(s,world(session));require(s.path("busyUntil").isNull(),409,"Finish your activity before making this choice");
        ObjectNode outcome=stories.choose(s,body.path("beatId").asText(),body.path("choice").asText());store.save();ObjectNode out=object();out.set("sim",publicSim(s));out.set("outcome",outcome);return out;
    }
    void addSkill(ObjectNode skill,int gain){int level=skill.path("level").asInt(),xp=skill.path("xp").asInt()+gain;while(level<10&&xp>=100*(level+1)){xp-=100*(level+1);level++;}skill.put("level",level).put("xp",level==10?0:xp).put("next",100*(level+1));}
    void updateLevel(ObjectNode s){int level=1,xp=s.path("xp").asInt();while(level<100&&xp>=100*level*(level+1)/2)level++;s.put("level",level).put("xpNext",100*level*(level+1)/2);}
    String outcomeText(ObjectNode a,String loc,String action,double cash,ObjectNode needs,ObjectNode skills,int goals){
        if(action.equals("visit-workplace"))return "You arrived at the workplace. Apply for an entry role while it is open.";
        String opening=loc.equals("home")?switch(action){case "sleep"->"You wake up with a clearer head.";case "cook"->"Dinner is on the table.";case "shower"->"Freshened up and ready to go.";case "invite"->"Good company makes home feel brighter.";default->a.path("label").asText()+".";}:a.path("label").asText()+".";
        List<String> changes=new ArrayList<>();if(cash>0)changes.add("Earned $"+(int)cash);else if(cash<0)changes.add("Spent $"+(int)-cash);
        needs.fields().forEachRemaining(e->{long change=Math.round(e.getValue().asDouble());if(change!=0)changes.add(Content.title(e.getKey())+" "+(change>0?"+":"")+change);});
        skills.fields().forEachRemaining(e->{if(e.getValue().asInt()>0)changes.add(Content.title(e.getKey())+" +"+e.getValue().asInt()+" XP");});
        if(changes.isEmpty())changes.add("You are already feeling refreshed");if(goals>0)changes.add(goals+" daily goal"+(goals>1?"s":"")+" completed");
        return opening+" "+String.join(" · ",changes)+".";
    }
    synchronized ObjectNode stats(){Set<String> users=new HashSet<>();for(var e:community.online.entrySet())if(e.getValue()>now()-12000)users.add(e.getKey().substring(e.getKey().indexOf(':')+1));return object().put("online",users.size()).put("visits",++visits);}
    @jakarta.annotation.PreDestroy synchronized void checkpoint(){store.save();}
    long createdAt(ObjectNode s){return s.path("createdAt").asLong(table("users").path(s.path("userId").asText()).path("createdAt").asLong(now()));}
    boolean established(ObjectNode s){return now()-createdAt(s)>=1440000L;}
    synchronized ObjectNode daily(String token,String city){content.city(city);ObjectNode c=clock(world(session(token,false)));return object().put("date","Day "+c.path("day").asInt()).put("weekday",c.path("weekday").asText()).put("weather",city.equals("bay")?"Coastal haze":city.equals("nyc")?"Clear and crisp":"Warm and sunny").put("headline","A new day, a city of possibilities").put("tip","Keep your needs up. Home is always open.");}
    synchronized String defaultCity(String token,String city){if(!city.isBlank())return city;ObjectNode session=session(token,false);JsonNode s=session==null?null:table("sims").get(simKey(session));return s==null?"atl":s.path("city").asText("atl");}
    synchronized ObjectNode mayor(String token,String city){return civic.read(token,city);}
    synchronized ObjectNode mayorAction(String token,String kind,JsonNode body){return civic.mutate(token,kind,body);}
    synchronized ObjectNode plots(String token,String city){return property.readPlots(token,city);}
    synchronized ObjectNode buyPlot(String token,JsonNode body){return property.buyPlot(token,body);}
    synchronized ObjectNode billboards(String token,String city){return property.readBoards(token,city);}
    synchronized ObjectNode bookBillboard(String token,JsonNode body){return property.book(token,body);}
    synchronized ObjectNode homes(String token,String city){return property.homes(token,city);}
    synchronized ObjectNode moveHome(String token,JsonNode body){return property.move(token,body);}
    synchronized byte[] atlas(String token,String city,String world){return property.atlas(token,city,world);}
    synchronized byte[] art(String token,String kind,String id){return property.art(token,kind,id);}
    synchronized ObjectNode players(String token,String city){return community.players(world(session(token,false)),city);}
    synchronized ObjectNode chat(String token,String city){return community.chat(token,city);}
    synchronized ObjectNode say(String token,JsonNode body){return community.say(token,body);}
    synchronized ObjectNode social(String token,JsonNode body){return community.social(token,body);}
    static boolean containsEmoji(String s){return s.codePoints().anyMatch(cp->cp>=0x1F000||cp>=0x2600&&cp<=0x27BF||cp==0xFE0F||cp==0x200D);}
}
