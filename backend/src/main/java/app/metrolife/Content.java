package app.metrolife;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.util.*;

@Component
public class Content {
    final ObjectMapper mapper;
    final ObjectNode world;
    static final String[] SKILLS = {"fitness","cooking","music","tech","charisma","creativity","business"};
    static final String[] NEEDS = {"energy","hunger","fun","social"};
    static final String[] TRACKS = {"tech","music","sports","food","finance","arts","civic","health"};
    static final String[] ASPIRATIONS = {"founder","headliner","mayor","restaurateur","athlete","collector","mogul"};
    static final String[] ASPIRATION_NAMES = {"Startup Founder","Headliner","Mayor","Restaurateur","Pro Athlete","Art Collector","Real-Estate Mogul"};
    public Content(ObjectMapper mapper) throws IOException {
        this.mapper = mapper;
        try(var in=getClass().getResourceAsStream("/static-data/world.json")) {
            if(in==null) throw new IOException("Canonical world content missing");
            world=(ObjectNode)mapper.readTree(in);
        }
        for(JsonNode c:world.withArray("cities")) {
            ObjectNode city=(ObjectNode)c; int n=0;
            for(JsonNode nh:city.withArray("neighborhoods")) ((ObjectNode)nh).put("rent",(city.path("id").asText().equals("atl")?65:110)+15*n++);
            for(JsonNode l:city.withArray("landmarks")) {
                ObjectNode loc=(ObjectNode)l; ArrayNode labels=(ArrayNode)loc.get("actions"),actions=mapper.createArrayNode();
                for(int i=0;i<labels.size();i++) actions.add(expand(loc,labels.get(i).asText(),i));
                loc.set("actions",actions);
            }
            ArrayNode home=city.putArray("homeActions");
            home.add(action("sleep","Get some sleep","rest","moon",60,0,0,Map.of("energy",48,"hunger",-5),Map.of()));
            home.add(action("cook","Cook a fresh meal","food","cooking-pot",30,12,0,Map.of("hunger",38,"fun",5),Map.of("cooking",24)));
            home.add(action("shower","Take a shower","rest","droplets",15,0,0,Map.of("energy",18,"fun",12),Map.of()));
            home.add(action("invite","Invite a friend over","social","users",30,0,0,Map.of("social",35,"fun",10),Map.of("charisma",18)));
        }
        String[] effects={"Non-flight airport rides cost $0.","Parks stay open until midnight.","Work activities pay 5% more.","Culture activities are free after 18:00 and open until midnight.","Daily rent is reduced by 20%.","Nightlife venues stay open until 04:00."};int policyIndex=0;for(JsonNode policy:world.path("policies"))((ObjectNode)policy).put("effect",effects[policyIndex++]);
        ArrayNode skills=world.putArray("skills"); String[] icons={"dumbbell","cooking-pot","music","cpu","messages-square","palette","chart-no-axes-combined"};
        for(int i=0;i<SKILLS.length;i++) skills.addObject().put("id",SKILLS[i]).put("label",title(SKILLS[i])).put("icon",icons[i]);
        ArrayNode careers=world.putArray("careers");
        String[] workplaces={"techVillage","fox","benz","ponce","techVillage","high","capitol","grady"};
        String[] careerSkills={"tech","music","fitness","cooking","business","creativity","charisma","fitness"};
        String[][] titles={{"Support Associate","Developer","Senior Engineer","Technical Lead","CTO"},{"Stage Assistant","Session Musician","Touring Artist","Headliner","Music Director"},{"Team Assistant","Trainer","Athlete","Team Captain","Champion"},{"Kitchen Porter","Line Cook","Sous Chef","Head Chef","Restaurateur"},{"Office Assistant","Analyst","Advisor","Portfolio Manager","Partner"},{"Gallery Assistant","Studio Artist","Curator","Art Director","Creative Director"},{"Community Aide","Organizer","Policy Analyst","Chief of Staff","City Director"},{"Care Assistant","Health Educator","Clinician","Department Lead","Medical Director"}};
        for(int t=0;t<TRACKS.length;t++) {
            ObjectNode career=careers.addObject().put("track",TRACKS[t]).put("label",title(TRACKS[t])).put("icon",t==7?"heart-pulse":"briefcase");
            ArrayNode levels=career.putArray("levels");
            for(int level=1;level<=5;level++) {
                ObjectNode row=levels.addObject().put("level",level).put("title",titles[t][level-1]).put("city","atl").put("loc",workplaces[t]).put("payPerHour",75+level*45).put("shiftsToPromote",3+level);
                row.putObject("requires").putObject("skills").put(careerSkills[t],(level-1)*2);
            }
            ObjectNode shift=action("shift-"+TRACKS[t],"Work a shift","work","briefcase",60,0,120,Map.of("energy",-10,"hunger",-7,"fun",-3),Map.of(careerSkills[t],75));
            shift.putObject("requires").put("job",TRACKS[t]);ArrayNode workplaceActions=landmark("atl",workplaces[t]).withArray("actions");boolean existingShift=false;for(JsonNode existing:workplaceActions)if(existing.path("label").asText().equals("Work a shift")&&existing.path("requires").path("job").asText().equals(TRACKS[t]))existingShift=true;if(!existingShift)workplaceActions.add(shift);
            for(String other:new String[]{"nyc","bay"}){ArrayNode actions=landmark(other,workplace(other,TRACKS[t])).withArray("actions");boolean exists=false;for(JsonNode a:actions)if(a.path("requires").path("job").asText().equals(TRACKS[t]))exists=true;if(!exists)actions.add(shift.deepCopy());}
        }
        for(JsonNode city:world.path("cities"))for(JsonNode place:city.path("landmarks")){boolean workplace=false;for(String track:TRACKS)if(workplace(city.path("id").asText(),track).equals(place.path("id").asText()))workplace=true;if(workplace)((ObjectNode)place).withArray("actions").add(action("visit-workplace","Visit the workplace","rest","footprints",1,0,0,Map.of(),Map.of()).put("xp",0));}
        ArrayNode aspirations=world.putArray("aspirations");
        for(int i=0;i<ASPIRATIONS.length;i++) {
            ObjectNode aspiration=aspirations.addObject().put("id",ASPIRATIONS[i]).put("label",ASPIRATION_NAMES[i]).put("icon",new String[]{"rocket","mic-vocal","landmark","utensils","trophy","palette","house"}[i]).put("blurb","Build your own path, one good day at a time.");
            ArrayNode milestones=aspiration.putArray("milestones");
            for(int step=0;step<6;step++) {
                ObjectNode m=milestones.addObject().put("id",ASPIRATIONS[i]+"-"+step).put("text",Progression.TEXTS[i][step]);
                m.putObject("reward").put("cash",150*(step+1)).put("xp",50*(step+1));
            }
        }
    }
    ObjectNode action(String id,String label,String kind,String icon,int duration,int cost,int pay,Map<String,Integer> needs,Map<String,Integer> skills) {
        ObjectNode a=mapper.createObjectNode().put("id",id).put("label",label).put("kind",kind).put("icon",icon).put("durationMin",duration).put("cost",cost).put("pay",pay).put("xp",15);
        a.set("needs",mapper.valueToTree(needs)); a.set("skills",mapper.valueToTree(skills)); return a;
    }
    private ObjectNode expand(ObjectNode loc,String label,int index) {
        String s=label.toLowerCase(Locale.ROOT),cat=loc.path("category").asText();
        String kind="fun",skill="",icon=loc.path("icon").asText(); int cost=10,pay=0;
        Map<String,Integer> needs=Map.of("fun",20,"energy",-3);
        if(s.startsWith("fly to")) return action("a"+index,label,"travel","plane",90,180,0,Map.of("energy",-8,"fun",5),Map.of()).put("to",s.contains("new york")?"nyc":s.contains("atlanta")?"atl":"bay");
        if(s.matches(".*(work |shift|usher|busk|sell |bartend|intern|ship a feature|trade the open|play a set|dj a set|play an open mic|perform at).*")) {
            kind="work"; cost=0; pay=95; needs=Map.of("energy",-10,"hunger",-7,"fun",-3);
            skill=s.contains("kitchen")||s.contains("line")?"cooking":cat.equals("music")||cat.equals("nightlife")?"music":"business";
        } else if(s.matches(".*(eat |meal|dumplings|burrito|chowder|dim sum|food hall|get a slice|grab ).*")) {kind="food";cost=18;needs=Map.of("hunger",35,"fun",7);skill="cooking";}
        else if(s.matches(".*(class|study|hackathon|co-work|sketch|interview|pitch|raise a seed|start something).*")) {kind="learn";cost=15;needs=Map.of("fun",10,"energy",-5);skill=cat.equals("culture")?"creativity":cat.equals("tech")||cat.equals("education")?"tech":"business";}
        else if(s.matches(".*(run |jog |bike |tennis|swim|shoot around|cycle).*")) {kind="learn";cost=0;needs=Map.of("fun",15,"energy",-8,"hunger",-5);skill="fitness";}
        else if(s.matches(".*(friends|network|club|debate|co-founder|meet |share ).*")) {kind="social";cost=0;needs=Map.of("social",30,"fun",10);skill="charisma";}
        else if(cat.equals("civic")) {kind="civic";cost=0;needs=Map.of("social",20);skill="charisma";}
        else if(s.contains("reflect")||s.contains("check-up")) {kind="rest";cost=s.contains("check-up")?35:0;needs=Map.of("energy",25,"fun",10);}
        else if(cat.equals("park")||cat.equals("sight")||cat.equals("waterfront")) cost=0;
        icon=s.contains("pitch")?"rocket":s.contains("co-work")?"laptop":s.contains("co-founder")?"users":kind.equals("food")?"utensils":kind.equals("social")?"users":kind.equals("work")?"briefcase":kind.equals("learn")?"book-open":s.contains("ride")||s.contains("bike")?"bike":s.contains("watch")||s.contains("tour")?"eye":icon;
        ObjectNode a=action("a"+index,label,kind,icon,kind.equals("work")?60:30,cost,pay,needs,skill.isBlank()?Map.of():Map.of(skill,20));
        if(s.equals("work a shift")){a.putObject("requires").put("job","health");a.putObject("skills").put("fitness",75);}
        return a;
    }
    ObjectNode city(String id) {for(JsonNode c:world.path("cities")) if(c.path("id").asText().equals(id)) return (ObjectNode)c;throw new ApiException(400,"Choose Atlanta, New York or the Bay Area");}
    ObjectNode landmark(String city,String id) {for(JsonNode l:city(city).path("landmarks")) if(l.path("id").asText().equals(id)) return (ObjectNode)l;throw new ApiException(404,"That place could not be found");}
    ObjectNode neighborhood(String city,String id) {for(JsonNode n:city(city).path("neighborhoods")) if(n.path("id").asText().equals(id)) return (ObjectNode)n;throw new ApiException(400,"Choose a neighborhood in this city");}
    ObjectNode aspiration(String id) {for(JsonNode a:world.path("aspirations")) if(a.path("id").asText().equals(id)) return (ObjectNode)a;throw new ApiException(400,"Choose an aspiration");}
    static String title(String s) {return s.substring(0,1).toUpperCase(Locale.ROOT)+s.substring(1);}
    static String workplace(String city,String track){String[] places=city.equals("nyc")?new String[]{"dumbo","apollo","yankee","chinatown","wallStreet","met","cityHall","presbyterian"}:city.equals("bay")?new String[]{"techCampus","fillmore","chaseCenter","missionEats","sandHill","sfCityHall","sfCityHall","ucsf"}:new String[]{"techVillage","fox","benz","ponce","techVillage","high","capitol","grady"};return places[Arrays.asList(TRACKS).indexOf(track)];}
}
