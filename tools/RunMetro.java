import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.net.URI;
import java.net.http.*;
import java.security.*;
import java.util.*;
import java.util.zip.*;
import java.io.*;
import java.time.Duration;

/** Java 21 source launcher; reviewers need no Node, Maven, shell download tools or account. */
public class RunMetro {
 static final String VERSION="3.10.0", HASH="22d31676d5b92ed53308c19ecded3245d0efd0cddfec51ec7bab62f4f13ad70ddddceff8e62940e0e8e2421f3cde8106737f4becec0aa034ffeff2a754e88337";
 static final Path ROOT=Path.of("").toAbsolutePath().normalize(),RUNTIME=ROOT.resolve(".runtime"),BACKEND=ROOT.resolve("backend");
 static String digest(Path file,String algorithm)throws Exception{MessageDigest md=MessageDigest.getInstance(algorithm);try(var in=Files.newInputStream(file)){byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1)md.update(buffer,0,n);}return HexFormat.of().formatHex(md.digest());}
 static void unzip(Path archive,Path destination)throws Exception{Files.createDirectories(destination);try(var zip=new ZipInputStream(Files.newInputStream(archive))){ZipEntry entry;while((entry=zip.getNextEntry())!=null){Path target=destination.resolve(entry.getName()).normalize();if(!target.startsWith(destination))throw new IOException("Unsafe archive entry");if(entry.isDirectory())Files.createDirectories(target);else{Files.createDirectories(target.getParent());Files.copy(zip,target,StandardCopyOption.REPLACE_EXISTING);}}}}
 static Path maven()throws Exception{
  Path home=RUNTIME.resolve("apache-maven-"+VERSION);if(Files.isRegularFile(home.resolve("bin/m2.conf")))return home;
  Files.createDirectories(RUNTIME);Path zip=RUNTIME.resolve("maven.zip");
  System.out.println("First launch: downloading pinned Maven "+VERSION+" from Maven Central.");
  try(var client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).followRedirects(HttpClient.Redirect.NORMAL).build()){
   var request=HttpRequest.newBuilder(URI.create("https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/"+VERSION+"/apache-maven-"+VERSION+"-bin.zip")).timeout(Duration.ofMinutes(3)).GET().build();
   var response=client.send(request,HttpResponse.BodyHandlers.ofFile(zip));if(response.statusCode()!=200)throw new IOException("Maven download HTTP "+response.statusCode());
  }
  if(!digest(zip,"SHA-512").equals(HASH))throw new IOException("Maven archive checksum mismatch");unzip(zip,RUNTIME);Files.delete(zip);return home;
 }
 static String fingerprint()throws Exception{
  MessageDigest hash=MessageDigest.getInstance("SHA-256");
  for(String folder:List.of("backend/src/main","shared","frontend/public","tools")){
   try(var paths=Files.walk(ROOT.resolve(folder))){for(Path path:paths.filter(Files::isRegularFile).sorted().toList()){hash.update(ROOT.relativize(path).toString().getBytes(StandardCharsets.UTF_8));hash.update(digest(path,"SHA-256").getBytes(StandardCharsets.US_ASCII));}}
  }
  hash.update(Files.readAllBytes(BACKEND.resolve("pom.xml")));return HexFormat.of().formatHex(hash.digest());
 }
 static int run(List<String> command,Path directory)throws Exception{Process child=new ProcessBuilder(command).directory(directory.toFile()).inheritIO().start();Thread shutdown=new Thread(()->{child.descendants().forEach(ProcessHandle::destroy);child.destroy();});Runtime.getRuntime().addShutdownHook(shutdown);try{return child.waitFor();}finally{Runtime.getRuntime().removeShutdownHook(shutdown);}}
 public static void main(String[] args)throws Exception{
  if(Runtime.version().feature()<21)throw new IllegalStateException("Metro Life needs Java 21 or newer.");
  String java=Path.of(System.getProperty("java.home"),"bin",System.getProperty("os.name").startsWith("Windows")?"java.exe":"java").toString();
  Path jar=BACKEND.resolve("target/backend-0.0.1-SNAPSHOT.jar"),stamp=RUNTIME.resolve("build.sha256");String wanted=fingerprint();
  if(!Files.isRegularFile(jar)||!Files.isRegularFile(stamp)||!Files.readString(stamp).equals(wanted)){
   Path home=maven(),dist=ROOT.resolve("frontend/dist");unzip(ROOT.resolve("tools/frontend.zip"),dist);
   try(var paths=Files.walk(ROOT.resolve("frontend/public"))){for(Path source:paths.filter(Files::isRegularFile).toList()){Path target=dist.resolve(ROOT.resolve("frontend/public").relativize(source));Files.createDirectories(target.getParent());Files.copy(source,target,StandardCopyOption.REPLACE_EXISTING);}}
   Path boot;try(var paths=Files.list(home.resolve("boot"))){boot=paths.filter(p->p.getFileName().toString().endsWith(".jar")).findFirst().orElseThrow();}
   System.out.println("Building Metro Life once. Frontend is included; Node is not needed.");
   int code=run(List.of(java,"-Dmaven.home="+home,"-Dclassworlds.conf="+home.resolve("bin/m2.conf"),"-Dmaven.multiModuleProjectDirectory="+BACKEND,"-cp",boot.toString(),"org.codehaus.plexus.classworlds.launcher.Launcher","-q","-DskipTests","clean","package"),BACKEND);if(code!=0)throw new IOException("Backend build failed: "+code);Files.writeString(stamp,wanted);
  }
  String port=System.getenv().getOrDefault("METRO_PORT","8080");System.out.println("Metro Life: http://localhost:"+port+"/  (Ctrl+C to stop)");
  System.exit(run(List.of(java,"-jar",jar.toString(),"--server.port="+port),BACKEND));
 }
}
